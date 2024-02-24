import Compiler from './Compiler.js';
const code = ` 
import void PrintInt int i #{
    console.log(i);
}

import void PrintFloat float f #{
    console.log(f);
}

int GetValue int x int y{
    x y *
}

export int Main{
    1.5f := j
    loop{
        1.1f += j
        j PrintFloat
        j 15f > if{
            break
        }
    }
    0 := x
    loop{
        2 += x 
        x PrintInt
        x 10 > if{
            break
        }
    }
    5 1 - := y
    4 4 GetValue := z
    z y *
}`;

Compiler(code);
