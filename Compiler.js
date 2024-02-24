
import Tokenize from './Tokenizer.js';
import Types from './Types.js';
import ILToWasm from './ILToWasm.js';
import InsertGlobalMemAddressConst from './InsertGlobalMemAddressConst.js';

function Compiler(code){
    var types = new Types();
    var tokens = Tokenize(code);
    var importFunctions = [];
    var functions = [];
    var singletons = [];

    function FindFunctions(){
        function ParseFunction(_export){
            var returnType = tokens[i].value;
            var name = tokens[i+1].value;
            i+=2;
            var parameters = [];
            while(true){
                if(tokens[i].type == 'Punctuation' && tokens[i].value == '{'){
                    i++;
                    break;
                }
                else{
                    parameters.push({type:tokens[i].value, name:tokens[i+1].value});
                    i+=2;
                }
            }
            
            var start = i;
            var depth = 0;
            while(true){
                if(tokens[i].type == 'Punctuation' && tokens[i].value == '{'){
                    depth++;
                }
                else if(tokens[i].type == 'Punctuation' && tokens[i].value == '}'){
                    depth--;
                    if(depth<0){
                        var func = {export:_export, returnType, name, parameters, tokens:tokens.slice(start, i)};
                        func.functionSignatureName = types.AddFunction(func);
                        i++;
                        return func;
                    }
                }
                i++;
            }
        }
    
        function ParseImportFunction(){
            var returnType = tokens[i+1].value;
            var name = tokens[i+2].value;
            i+=3;
            var parameters = [];
            while(true){
                if(tokens[i].type == 'Code'){
                    var importFunction = {returnType, name, parameters, javascript:tokens[i].value};
                    importFunction.functionSignatureName = types.AddFunction(importFunction);
                    i++;
                    return importFunction;
                }
                else{
                    parameters.push({type:tokens[i].value, name:tokens[i+1].value});
                    i+=2;
                }
            }
        }

        function ParseClass(type){
            var name = tokens[i+1].value;
            i+=2;
            var fields = [];
            if(tokens[i].type == 'Punctuation' && tokens[i].value == '{'){
                i++;
                while(true){
                    if(tokens[i].type == 'Punctuation' && tokens[i].value == '}'){
                        i++;
                        return {type, name, fields};
                    }
                    else{
                        fields.push({type:tokens[i].value, name:tokens[i+1].value});
                        i+=2;
                    }
                }
            }
        }

        var i = 0;
        while(true){
            if(i>=tokens.length){
                return;
            }
            if(tokens[i].type == 'Varname' && tokens[i].value == 'singleton'){
                singletons.push(ParseClass('singleton'));
            }
            if(tokens[i].type == 'Varname' && tokens[i].value == 'import'){
                importFunctions.push(ParseImportFunction());
            }
            else if(tokens[i].type == 'Varname' && tokens[i].value == 'export'){
                i++;
                functions.push(ParseFunction(true));
            }
            else{
                functions.push(ParseFunction(false));
            }
        }
    }
    FindFunctions();
    
    function CreateIL(func){
        func.locals = [];
        func.il = [];

        var tokens = func.tokens;
        var blocks = [];
    
        function FindLoopInBlock(){
            for(var i=0;i<blocks.length;i++){
                if(blocks[blocks.length - i - 1] == 'loop'){
                    return i;
                }
            }
            return -1;
        }
        
        function PushStack(type){
            stack.push(type);
        }
    
        function PopStackGetType(){
            return stack.pop();
        }
    
        function PopStack(type){
            if(stack.length == 0){
                throw "Empty stack";
            }
            var pop = stack.pop();
            if(pop != type){
                throw "Expecting type: '"+type+"' got: '"+pop+"'";
            }
        }
        
        function UpdateStackFromFunctionSignatureName(functionSignatureName){
            var stackIncreaseAmount = 0;
            var functionSignature = types.GetFunctionSignature(functionSignatureName);
            for(var p of functionSignature.parameters){
                stackIncreaseAmount --;
                PopStack(p);
            }
            if(functionSignature.returnType!='void'){
                PushStack(functionSignature.returnType);
                stackIncreaseAmount++;
            }
            return stackIncreaseAmount;
        }
    
        function GetIdentifier(name){
            for(var p of func.parameters){
                if(p.name == name){
                    p.identifierType = 'local';
                    return p;
                }
            }
            for(var l of func.locals){
                if(l.name == name){
                    l.identifierType = 'local';
                    return l;
                }
            }
            for(var s of singletons){
                if(s.name == name){
                    s.identifierType = 'singleton';
                    return s;
                }
            }
            for(var f of functions){
                if(f.name == name){
                    f.identifierType = 'function';
                    return f;
                }
            }
            for(var f of importFunctions){
                if(f.name == name){
                    f.identifierType = 'function';
                    return f;
                }
            }
            throw "Cant find identifier: '"+name+"'";
        }
    
        var stack = [];
        var index = 0;

        function ArithmeticOperator(op){
            var a = PopStackGetType();
            var b = PopStackGetType();
            if(a==b){
                if(a == 'int'){
                    func.il.push({type:'i32_'+op, stackIncreaseAmount:-1});
                }
                else if(a=='float'){
                    func.il.push({type:'f32_'+op, stackIncreaseAmount:-1});
                }
                else{
                    throw "Unexpected type: "+a;
                }
                PushStack(a);
            }
            else{
                throw "Arithmetic operator: expecting 2 of the same types: "+op+" : "+a+" -- "+b;
            }
        }

        function ComparisonOperator(op){
            var a = PopStackGetType();
            var b = PopStackGetType();
            if(a==b){
                if(a == 'int'){
                    func.il.push({type:'i32_'+op, stackIncreaseAmount:-1});
                }
                else if(a=='float'){
                    func.il.push({type:'f32_'+op, stackIncreaseAmount:-1});
                }
                else{
                    throw "Unexpected type: "+a;
                }
                PushStack('bool');
            }
            else{
                throw "Comparison operator: expecting 2 of the same types: "+op+" : "+a+" -- "+b;
            }
        }

        function GetField(singleton, name){
            for(var f of singleton.fields){
                if(f.name == name){
                    return f;
                }
            }
        }

        while(true){
            if(index>=tokens.length){
                break;
            }
            if(tokens[index].type == 'Varname'){
                if(tokens[index].value == 'if'){
                    blocks.push('if');
                    func.il.push({type:'if', stackIncreaseAmount:-1});
                    index++;
                    PopStack('bool');
                    if(!(tokens[index].type == 'Punctuation' && tokens[index].value == '{')){
                        throw "Expecting { "+JSON.stringify(tokens[index+1]);
                    }
                }
                else if(tokens[index].value == 'loop'){
                    blocks.push('loop');
                    func.il.push({type:'loop', stackIncreaseAmount:0});
                    index++;
                    if(!(tokens[index].type == 'Punctuation' && tokens[index].value == '{')){
                        throw "Expecting { "+JSON.stringify(tokens[index+1]);
                    }
                }
                else if(tokens[index].value == 'break'){
                    var loopID = FindLoopInBlock();
                    if(loopID == -1){
                        throw "Break statement should be inside a loop: "+JSON.stringify(tokens[index]);
                    }
                    var value = loopID + 1;
                    func.il.push({type:'br', value, stackIncreaseAmount:0});
                }
                else{
                    var value = GetIdentifier(tokens[index].value);
                    if(value.identifierType == 'singleton'){
                        if(tokens[index+1].type == 'Punctuation' && tokens[index+1].value == '.'){
                            if(tokens[index+2].type == 'Varname'){
                                var field = GetField(value, tokens[index+2].value);
                                index+=2;
                                func.il.push({type:'get_global', value:field, stackIncreaseAmount:1});
                                PushStack(field.type);
                            }
                            else{
                                throw "Expecting varname got: "+JSON.stringify(tokens[index+2]);
                            }
                        }
                        else{
                            throw "Expecting . got: "+JSON.stringify(tokens[index+1])
                        }
                    }
                    else if(value.identifierType == 'function'){
                        var stackIncreaseAmount = UpdateStackFromFunctionSignatureName(value.functionSignatureName);
                        func.il.push({type:'call', value, stackIncreaseAmount});
                    }
                    else if(value.identifierType == 'local'){
                        func.il.push({type:'get_local', value, stackIncreaseAmount:1});
                        PushStack(value.type);
                    }
                    else{
                        throw "Unexpected identifiertype: "+JSON.stringify(value);
                    }
                }
            }
            else if(tokens[index].type == 'Int'){
                func.il.push({type:'i32_const', value:tokens[index].value, stackIncreaseAmount:1});
                PushStack('int');
            }
            else if(tokens[index].type == 'Float'){
                func.il.push({type:'f32_const', value:tokens[index].value, stackIncreaseAmount:1});
                PushStack('float');
            }
            else if(tokens[index].type == 'Punctuation'){
                if(tokens[index].value == '}'){
                    var blocktype = blocks.pop();
                    if(blocktype == 'if'){
                        func.il.push({type:'end_if', stackIncreaseAmount:0})
                    }
                    else if(blocktype == 'loop'){
                        func.il.push({type:'end_loop', stackIncreaseAmount:0})
                    }
                    else{
                        throw "Unexpected blocktype: "+blocktype;
                    }
                }
                else if(tokens[index].value == '+'){
                    ArithmeticOperator('add');
                }
                else if(tokens[index].value == '*'){
                    ArithmeticOperator('mul');
                }
                else if(tokens[index].value == '/'){
                    ArithmeticOperator('div');
                }
                else if(tokens[index].value == '-'){
                    ArithmeticOperator('sub');
                }
                else if(tokens[index].value == '<'){
                    ComparisonOperator('lt');
                }
                else if(tokens[index].value == '>'){
                    ComparisonOperator('gt');
                }
                else if(tokens[index].value == '+='){
                    if(tokens[index+1].type == 'Varname'){
                        var name = tokens[index+1].value;
                        var value = GetIdentifier(name);
                        if(value.identifierType=='function'){
                            throw "Got function type for variable";
                        }
                        PopStack(value.type);
                        if(value.type == 'float'){
                            func.il.push({type:'f32_+=', value, stackIncreaseAmount:-1});
                        }
                        else if(value.type == 'int'){
                            func.il.push({type:'i32_+=', value, stackIncreaseAmount:-1});
                        }
                        else{
                            throw "+= Unexpected type: "+type;
                        }
                        index++;
                    }
                    else{
                        throw "+= Expecting to be followed by varname: "+JSON.stringify(tokens[index+1]);
                    }
                }
                else if(tokens[index].value == '='){
                    if(tokens[index+1].type == 'Varname'){
                        var name = tokens[index+1].value;
                        var value = GetIdentifier(name);
                        if(value.identifierType == 'singleton'){
                            if(tokens[index+2].type == 'Punctuation' && tokens[index+2].value == '.'){
                                if(tokens[index+3].type == 'Varname'){
                                    var field = GetField(value, tokens[index+3].value);
                                    index+=3;
                                    func.il.push({type:'set_global', value:field, stackIncreaseAmount:-1});
                                    PopStack(field.type);
                                }
                                else{
                                    throw "Expecting varname got: "+JSON.stringify(tokens[index+2]);
                                }
                            }
                            else{
                                index++;
                                for(var i=value.fields.length-1;i>=0;i--){
                                    var f = value.fields[i];
                                    func.il.push({type:'set_global', value:f, stackIncreaseAmount:-1});
                                    PopStack(f.type);
                                }
                            }
                        }
                        else if(value.identifierType=='local'){
                            PopStack(value.type);
                            func.il.push({type:'set_local', value, stackIncreaseAmount:-1});
                            index++;
                            
                        }
                        else{
                            throw "Got function type for variable";
                        }
                    }
                    else{
                        throw "= Expecting to be followed by varname: "+JSON.stringify(tokens[index+1]);
                    }
                }
                else if(tokens[index].value == ':='){
                    if(tokens[index+1].type == 'Varname'){
                        var name = tokens[index+1].value;
                        var type = PopStackGetType();
                        var value = {type, name};
                        func.locals.push(value);
                        func.il.push({type:'set_local', value, stackIncreaseAmount:-1});
                        index++;
                        
                    }
                    else{
                        throw ":= Expecting to be followed by varname: "+JSON.stringify(tokens[index+1]);
                    }
                }
                else{
                    throw "FunctionWasm: Punctuation: Unexpected token: "+JSON.stringify(tokens.slice(index));
                }
            }
            else{
                throw "FunctionWasm: Unexpected token: "+JSON.stringify(tokens.slice(index));
            }
            index++;
        }
    
        if(func.returnType!='void'){
            PopStack(func.returnType);
        }
    
        if(stack.length>0){
            throw "Expecting 0 elements on stack: "+JSON.stringify(stack);
        }
    }
    
    var memLoc = 0;
    for(var s of singletons){
        for(var f of s.fields){
            f.memLoc = memLoc;
            memLoc+=4;
        }
    }

    for(var f of functions){
        CreateIL(f);
    }
    InsertGlobalMemAddressConst(functions);
    ILToWasm(functions, importFunctions);

}

export default Compiler;