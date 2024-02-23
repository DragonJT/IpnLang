import Level0Compiler from './Level0Compiler.js';

const code = ` 
IMPORT VOID PrintInt INT i #{
    console.log(i);
}

FN INT GetValue INT x INT y{
    x y *
}

EXPORT INT Main{
    INT{x y}
    LOOP{
        2 += x 
        x PrintInt
        x 10 > IF{
            BREAK
        }
    }
    5 1 - = y
    4 4 GetValue = x
    x y *
}`;

Level0Compiler('Main', code);