
import Tokenize from './Tokenizer.js';
import Parser from './Parser.js';

function Level0Compiler(code){
    var tokens = Tokenize(code);
    //copied quite a lot from https://github.com/ColinEberhardt/chasm

    // https://webassembly.github.io/spec/core/binary/instructions.html
    // https://pengowray.github.io/wasm-ops/
    const Opcode = {
        block: 0x02,
        loop: 0x03,
        br: 0x0c,
        br_if: 0x0d,
        if: 0x04,
        else: 0x05,
        end: 0x0b,
        call: 0x10,
        get_local: 0x20,
        set_local: 0x21,
        i32_store_8: 0x3a,
        i32_store: 0x36,
        i32_const: 0x41,
        f32_const: 0x43,
        i32_eqz: 0x45,
        i32_eq: 0x46,
        f32_eq: 0x5b,
        f32_lt: 0x5d,
        f32_gt: 0x5e,
        i32_and: 0x71,
        f32_add: 0x92,
        f32_sub: 0x93,
        f32_mul: 0x94,
        f32_div: 0x95,
        f32_neg: 0x8c,
        i32_trunc_f32_s: 0xa8,
        i32_load: 0x28,
        f32_load: 0x2a,
        f32_store: 0x38,
        i32_mul: 0x6c,
        i32_div: 0x6d,
        i32_add: 0x6a,
        i32_sub: 0x6b,
        i32_lt: 0x48,
        i32_gt: 0x4a,
        f32_convert_i32_s: 0xb2,
        return: 0x0f,
    };

    // https://webassembly.github.io/spec/core/binary/types.html
    const Valtype = {
        i32: 0x7f,
        f32: 0x7d
    };

    const ieee754 = (n) => {
        var data = new Float32Array([n]);
        var buffer = new ArrayBuffer(data.byteLength);
        var floatView = new Float32Array(buffer).set(data);
        return new Uint8Array(buffer);
    };

    const encodeString = (str) => [
        str.length,
        ...str.split("").map(s => s.charCodeAt(0))
    ];

    const signedLEB128 = (n) => {
        const buffer = [];
        let more = true;
        const isNegative = n < 0;
        const bitCount = Math.ceil(Math.log2(Math.abs(n))) + 1;
        while (more) {
            let byte = n & 0x7f;
            n >>= 7;
            if (isNegative) {
                n = n | -(1 << (bitCount - 8));
            }
            if ((n === 0 && (byte & 0x40) === 0) || (n === -1 && (byte & 0x40) !== 0x40)) {
                more = false;
            } else {
                byte |= 0x80;
            }
            buffer.push(byte);
        }
        return buffer;
    };

    const unsignedLEB128 = (n) => {
        const buffer = [];
        do {
            let byte = n & 0x7f;
            n >>>= 7;
            if (n !== 0) {
                byte |= 0x80;
            }
            buffer.push(byte);
        } while (n !== 0);
        return buffer;
    };

    // https://webassembly.github.io/spec/core/binary/types.html#binary-blocktype
    // https://github.com/WebAssembly/design/blob/main/BinaryEncoding.md#value_type
    const Blocktype = {
        void: 0x40,
        i32: 0x7f,
    }

    const flatten = (arr) => [].concat.apply([], arr);

    // https://webassembly.github.io/spec/core/binary/modules.html#sections
    const Section = {
        custom: 0,
        type: 1,
        import: 2,
        func: 3,
        table: 4,
        memory: 5,
        global: 6,
        export: 7,
        start: 8,
        element: 9,
        code: 10,
        data: 11
    };

    // http://webassembly.github.io/spec/core/binary/modules.html#export-section
    const ExportType = {
        func: 0x00,
        table: 0x01,
        mem: 0x02,
        global: 0x03
    }

    // http://webassembly.github.io/spec/core/binary/types.html#function-types
    const functionType = 0x60;

    const emptyArray = 0x0;

    // https://webassembly.github.io/spec/core/binary/modules.html#binary-module
    const magicModuleHeader = [0x00, 0x61, 0x73, 0x6d];
    const moduleVersion = [0x01, 0x00, 0x00, 0x00];

    // https://webassembly.github.io/spec/core/binary/conventions.html#binary-vec
    // Vectors are encoded with their length followed by their element sequence
    const encodeVector = (data) => [
        ...unsignedLEB128(data.length),
        ...flatten(data)
    ];

    // https://webassembly.github.io/spec/core/binary/modules.html#code-section
    const encodeLocal = (count, valtype) => [
        ...unsignedLEB128(count),
        valtype
    ];

    // https://webassembly.github.io/spec/core/binary/modules.html#sections
    // sections are encoded by their type followed by their vector contents
    const createSection = (sectionType, data) => [
        sectionType,
        ...encodeVector(data)
    ];

    const memoryImport = [
        ...encodeString("env"),
        ...encodeString("memory"),
        ExportType.mem,
        /* limits https://webassembly.github.io/spec/core/binary/types.html#limits -
        indicates a min memory size of one page */
        0x00,
        unsignedLEB128(10),
    ];
  
    var importFunctions = [];
    var functions = [];
    var parser = new Parser(tokens);

    function FindFunctions(){
        while(true){
            if(parser.OutOfBounds()){
                return;
            }
            if(parser.Is('Varname', 'import')){
                importFunctions.push(parser.ParseImportFunction());
            }
            else if(parser.Is('Varname', 'export')){
                parser.index++;
                functions.push(parser.ParseFunction(true));
            }
            else{
                functions.push(parser.ParseFunction(false));
            }
        }
    }
    FindFunctions();

    function EmitFunctionWasm(f){
        var locals = {int:[]};
        var wasm = [];
        var tokens = f.tokens;
        
        function EmitLocals(type){
            if(tokens[index].type == 'Varname' && tokens[index].value == type){
                index+=2;
                while(true){
                    if(tokens[index].type == 'Varname'){
                        locals[type].push({name:tokens[index].value, type, id});
                        index++;
                        id++;
                    }
                    else if(tokens[index].type == 'Punctuation' && tokens[index].value == '}'){
                        return true;
                    }
                    else{
                        throw "Locals: Unexpected token: "+JSON.stringify(tokens[index]);
                    }
                }
            }
            return false;
        }

        function GetLocal(name){
            for(var p of f.parameters){
                if(p.name == name){
                    return p;
                }
            }
            for(var l of locals.int){
                if(l.name == name){
                    return l;
                }
            }
        }

        function GetFunction(name){
            for(var f of importFunctions){
                if(f.name == name){
                    return f;
                }
            }
            for(var f of functions){
                if(f.name == name){
                    return f;
                }
            }
        }

        var id = 0;
        for(var p of f.parameters){
            p.id = id;
            id++;
        }
        var index = 0;
        var blocks = [];

        function FindLoopInBlock(){
            for(var i=0;i<blocks.length;i++){
                if(blocks[blocks.length - i - 1] == 'loop'){
                    return i;
                }
            }
            return -1;
        }

        while(true){
            if(index>=tokens.length){
                break;
            }
            if(EmitLocals('int')){}
            else if(tokens[index].type == 'Varname'){
                if(tokens[index].value == 'if'){
                    blocks.push('if');
                    wasm.push(Opcode.if, Blocktype.void);
                    index++;
                    if(!(tokens[index].type == 'Punctuation' && tokens[index].value == '{')){
                        throw "error expecting { "+JSON.stringify(tokens[index+1]);
                    }
                }
                else if(tokens[index].value == 'loop'){
                    blocks.push('loop');
                    wasm.push(Opcode.block, Blocktype.void);
                    wasm.push(Opcode.loop, Blocktype.void);
                    index++;
                    if(!(tokens[index].type == 'Punctuation' && tokens[index].value == '{')){
                        throw "error expecting { "+JSON.stringify(tokens[index+1]);
                    }
                }
                else if(tokens[index].value == 'break'){
                    var loopID = FindLoopInBlock();
                    if(loopID == -1){
                        throw "Error break statement should be inside a loop: "+JSON.stringify(tokens[index]);
                    }
                    wasm.push(Opcode.br, ...unsignedLEB128(loopID+1));
                }
                else{
                    var name = tokens[index].value;
                    var local = GetLocal(name);
                    if(local){
                        wasm.push(Opcode.get_local, ...unsignedLEB128(local.id));
                    }
                    else{
                        var func = GetFunction(name);
                        if(func){
                            wasm.push(Opcode.call, ...unsignedLEB128(func.id));
                        }
                        else{
                            throw "cant find local or function: "+name;
                        }
                    }
                }
            }
            else if(tokens[index].type == 'Int'){
                wasm.push(Opcode.i32_const, ...signedLEB128(tokens[index].value));
            }
            else if(tokens[index].type == 'Punctuation'){
                if(tokens[index].value == '}'){
                    var blocktype = blocks.pop();
                    if(blocktype == 'if'){
                        wasm.push(Opcode.end);
                    }
                    else if(blocktype == 'loop'){
                        wasm.push(Opcode.br, 0, Opcode.end, Opcode.end);
                    }
                    else{
                        throw "Unexpected blocktype: "+blocktype;
                    }
                }
                else if(tokens[index].value == '+'){
                    wasm.push(Opcode.i32_add);
                }
                else if(tokens[index].value == '*'){
                    wasm.push(Opcode.i32_mul);
                }
                else if(tokens[index].value == '/'){
                    wasm.push(Opcode.i32_div);
                }
                else if(tokens[index].value == '-'){
                    wasm.push(Opcode.i32_sub);
                }
                else if(tokens[index].value == '<'){
                    wasm.push(Opcode.i32_lt);
                }
                else if(tokens[index].value == '>'){
                    wasm.push(Opcode.i32_gt);
                }
                else if(tokens[index].value == '+='){
                    var localBytes = unsignedLEB128(GetLocal(tokens[index+1].value).id);
                    wasm.push(Opcode.get_local, ...localBytes);
                    wasm.push(Opcode.i32_add);
                    wasm.push(Opcode.set_local, ...localBytes);
                    index++;
                }
                else if(tokens[index].value == '='){
                    wasm.push(Opcode.set_local, ...unsignedLEB128(GetLocal(tokens[index+1].value).id));
                    index++;
                }
                else{
                    throw "FunctionWasm: Unexpected token: "+JSON.stringify(tokens[index]);
                }
            }
            else{
                throw "FunctionWasm: Unexpected token: "+JSON.stringify(tokens[index]);
            }
            index++;
        }
        return [1, ...encodeLocal(locals.int.length, Valtype.i32), ...wasm, Opcode.end];
    }

    var id = 0;
    for(var f of importFunctions){
        f.id = id;
        id++;
    }
    for(var f of functions){
        f.id = id;
        id++;
    }

    function EmitTypeSection(){
        function GetValtype(typeName){
            switch(typeName){
                case 'float': return Valtype.f32;
                case 'int': return Valtype.i32;
                default: throw "Unexpected valtype: "+typeName;
            }
        }
    
        function GetReturnArray(returnType){
            if(returnType == 'void')
                return [];
            else{
                return [GetValtype(returnType)];
            }
        }
    
        function EmitTypes(functions){
            return functions.map(f=>[
                functionType,
                ...encodeVector(f.parameters.map(p=>GetValtype(p.type))),
                ...encodeVector(GetReturnArray(f.returnType)),
            ]);
        }
        return createSection(Section.type, encodeVector([...EmitTypes(importFunctions), ...EmitTypes(functions)]));
    }
    
    function EmitImportSection(){
        function EmitImportFunctions(){
            return importFunctions.map((f,i)=>[
                ...encodeString("env"),
                ...encodeString(f.name),
                ExportType.func,
                ...unsignedLEB128(i)
            ]);
        }
    
        return createSection(Section.import, encodeVector([...EmitImportFunctions(), memoryImport]));
    }
    
    function EmitFuncSection(){
        return createSection(Section.func, encodeVector(functions.map(f=>unsignedLEB128(f.id))));
    }
    
    function EmitExportSection(){
       return createSection(
            Section.export,
            encodeVector(functions
                .filter(f=>f.export)
                .map(f=>[...encodeString(f.name), ExportType.func, ...unsignedLEB128(f.id)])),
        );
    }
    
    function EmitCodeSection(){
        return createSection(Section.code, encodeVector(functions.map(f=>encodeVector(EmitFunctionWasm(f)))));
    }
    
    function ImportObject(){
        var code = "var importObject = {env:{}};\n";
        code+="var global = {};\n";
        for(var f of importFunctions){
            code+="importObject.env."+f.name+"= (";
            for(var i=0;i<f.parameters.length;i++){
                code+=f.parameters[i].name;
                if(i<f.parameters.length-1)
                    code+=',';
            }
            code+=")=>{"
            code+=f.javascript;
            code+="};\n";
        }
        code+="return importObject;\n";
        return new Function('exports', code)(exports);
    }
    
    const wasm = Uint8Array.from([
        ...magicModuleHeader,
        ...moduleVersion,
        ...EmitTypeSection(),
        ...EmitImportSection(),
        ...EmitFuncSection(),
        ...EmitExportSection(),
        ...EmitCodeSection(),
    ]);
    
    var exports = {};
    var importObject = ImportObject();
    importObject.env.memory = new WebAssembly.Memory({ initial: 10, maximum: 10 });
    WebAssembly.instantiate(wasm, importObject).then(
        (obj) => {
            for(var f of functions.filter(f=>f.export)){
                exports[f.name] = obj.instance.exports[f.name];
            }
            console.log(exports.Main());
        }
    );
}

export default Level0Compiler;