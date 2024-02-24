
function Tokenize(code){
    var index = 0;
    var tokens = [];
    var doublePunctuation = [ '+=', ':=' ];

    function IsDigit(c){
        return c>='0' && c<='9';
    }

    function IsCharacter(c){
        return (c>='a' && c<='z') || (c>='A' && c<='Z') || c=='_';
    }

    function IsWhitespace(c){
        return (c==' ' || c=='\n' || c=='\t' || c=='\r');
    }

    function AddToken(type, start, end){
        tokens.push({type, start, end, value:code.substring(start, end)});
    }

    while(true){
        if(index>=code.length){
            return tokens;
        }
        var c = code[index];
        if(IsCharacter(c)){
            var start = index;
            index++;
            while(true){
                if(index>=code.length){
                    break;
                }
                var c = code[index];
                if(IsCharacter(c) || IsDigit(c)){
                    index++;
                    continue;
                }
                break;
            }
            AddToken('Varname', start, index);
        }
        else if(IsDigit(c)){
            var start = index;
            index++;
            var dot = false;
            while(true){
                if(index>=code.length){
                    if(dot){
                        AddToken('Double', start, index);
                    }
                    else{
                        AddToken('Int', start, index);
                    }
                    break;
                }
                var c = code[index];
                if(c=='.' && !dot){
                    dot = true;
                    index++;
                    continue;
                }
                else if(IsDigit(c)){
                    index++;
                    continue;
                }
                if(c=='f'){
                    AddToken('Number', start, index);
                    index++;
                }
                else if(c=='l'){
                    AddToken('Long', start, index);
                    index++;
                }
                else{
                    if(dot){
                        AddToken('Double', start, index);
                    }
                    else{
                        AddToken('Int', start, index);
                    }
                }
                break;
            }
        }
        else if(IsWhitespace(c)){
            index++;
        }
        else if(index+1<code.length && c=='#' && code[index+1]=='{'){
            index+=2;
            var start = index;
            var depth = 0;
            while(true){
                if(code[index] == '{'){
                    depth++;
                }
                else if(code[index] == '}'){
                    depth--;
                    if(depth<0){
                        break;
                    }
                }
                index++;
            }
            AddToken('Code', start, index);
            index++;
            continue;
        }
        else{
            if(index+1 < code.length){
                var c2=c+code[index+1];
                if(doublePunctuation.includes(c2)){
                    AddToken('Punctuation', index, index+2);
                    index+=2;
                    continue;
                }
            }
            AddToken('Punctuation', index, index+1);
            index++;
        }
    }
}

export default Tokenize;