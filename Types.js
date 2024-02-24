import Tokenize from "./Tokenizer.js";

class Types{

    GetFunctionSignatureName(functionSignature){
        var result = '(';
        for(var i=0;i<functionSignature.parameters.length;i++){
            result+=functionSignature.parameters[i];
            if(i<functionSignature.parameters.length){
                result+=' ';
            }
        }
        result+=')'+functionSignature.returnType;
        return result;
    }

    AddFunction(func){
        var functionSignature = {type:'functionSignature', parameters:func.parameters.map(p=>p.type), returnType:func.returnType};
        var name = this.GetFunctionSignatureName(functionSignature);
        this[name] = functionSignature;
        return name;
    }

    GetFunctionSignature(functionSignatureName){
        var result = this[functionSignatureName];
        if(result!=undefined){
            return result;
        }
        var tokens = Tokenize(functionSignatureName);
        var i = 0;
        var functionSignature = {type:'functionSignature'};
        functionSignature.parameters = [];
        if(tokens[i].type == 'Punctuation' && tokens[i].value == '('){
            i++;
            while(true){
                if(tokens[i].type == 'Punctuation' && tokens[i].value == ')'){
                    i++;
                    break;
                }
                else if(tokens[i].type == 'Varname'){
                    functionSignature.parameters.push(tokens[i].value);
                    i++;
                }
                else{
                    throw "Unexpected token: "+JSON.stringify(tokens[i]);
                }
            }
            if(tokens[i].type == 'Varname'){
                functionSignature.returnType = tokens[i].value;
                if(i!=tokens.length-1){
                    throw "Unexpected type length: "+functionSignatureName;
                }
                var name = this.GetFunctionSignatureName(functionSignature);
                this[name] = functionSignature;
                return functionSignature;
            }
            else{
                throw "Expecting Varname for returnType"+JSON.stringify(tokens[i].type);
            }
        }
        else{
            throw "Expecting ( got: "+JSON.stringify(tokens[i]);
        }
    }
}

export default Types;