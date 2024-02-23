class Parser{
    constructor(tokens){
        this.tokens = tokens;
        this.index = 0;
    }

    OutOfBounds(){
        return this.index>=this.tokens.length;
    }

    Type(delta=0){
        return this.tokens[this.index+delta].type;
    }

    Value(delta=0){
        return this.tokens[this.index+delta].value;
    }

    Is(type, value, delta=0){
        var token = this.tokens[this.index+delta];
        return this.index<this.tokens.length && token.type == type && token.value == value;
    }

    Token(delta=0){
        return this.tokens[this.index+delta];
    }

    ParseFunction(_export){
        var returnType = this.Value(1);
        var name = this.Value(2);
        this.index+=3;
        var parameters = [];
        while(true){
            if(this.Is('Punctuation', '{')){
                this.index++;
                break;
            }
            else{
                parameters.push({type:this.Value(), name:this.Value(1)});
                this.index+=2;
            }
        }
        var start = this.index;
        var depth = 0;
        while(true){
            if(this.Is('Punctuation', '{')){
                depth++;
            }
            else if(this.Is('Punctuation', '}')){
                depth--;
                if(depth<0){
                    var func = {export:_export, returnType, name, parameters, tokens:this.tokens.slice(start, this.index)};
                    this.index++;
                    return func;
                }
            }
            this.index++;
        }
    }

    ParseImportFunction(){
        var returnType = this.Value(1);
        var name = this.Value(2);
        this.index+=3;
        var parameters = [];
        while(true){
            if(this.Type() == 'Code'){
                var importFunction = {returnType, name, parameters, javascript:this.Value()};
                this.index++;
                return importFunction;
            }
            else{
                parameters.push({type:this.Value(), name:this.Value(1)});
                this.index+=2;
            }
        }
    }
   
}

export default Parser;