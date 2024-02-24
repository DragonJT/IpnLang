import Compiler from './Compiler.js';
const code = ` 
import void PrintInt int i #{
    console.log(i);
}

int GetValue int x int y{
    x y *
}

export int Main{
    0 := x
    loop{
        2 += x 
        x PrintInt
        x 10 > if{
            break
        }
    }
    5 1 - := y
    4 4 GetValue = x
    x y *
}`;

Compiler(code);
