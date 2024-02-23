
import Tokenize from './Tokenizer.js';
import Parser from './Parser.js';

function Level1Compiler(code){
    var tokens = Tokenize(code);
    var parser = new Parser(tokens);
    var functions = [];
    var importFunctions = [];

    function FindFunctions(){
        while(true){
            if(parser.OutOfBounds()){
                return;
            }
            if(parser.Is('Varname', 'export')){
                functions.push(parser.ParseFunction(true));
            }
            else if(parser.Is('Varname', 'fn')){
                functions.push(parser.ParseFunction(false));
            }
            else if(parser.Is('Varname', 'import')){
                importFunctions.push(parser.ParseImportFunction());
            }
            else{
                throw "Unexpected token: "+JSON.stringify(parser.Token());
            }
        }
    }

    function EmitFunction(f){

    }

    function EmitImportFunction(f){

    }

    FindFunctions();
    var result = '';
    for(var f of importFunctions){
        result+=EmitImportFunction(f);
    }
    for(var f of functions){
        result+=EmitFunction(f);
    }
    return result;
}

export default Level1Compiler;