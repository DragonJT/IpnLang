import Level0Compiler from './Level0Compiler.js';
import Level1Compiler from './Level1Compiler.js';
const code = ` 
import void PrintInt int i #{
    console.log(i);
}

int GetValue int x int y{
    x y *
}

export int Main{
    int{x y}
    loop{
        2 += x 
        x PrintInt
        x 10 > if{
            break
        }
    }
    5 1 - = y
    4 4 GetValue = x
    x y *
}`;

//const level0 = Level1Compiler(code);
Level0Compiler(code);