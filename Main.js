import Compiler from './Compiler.js';
const code = `

import void PrintInt int i #{
    console.log(i);
}

import void PrintFloat float f #{
    console.log(f);
}

singleton Test{
    int x
    int y
    float z
}

void PrintTest{
    Test.x PrintInt
    Test.y PrintInt
    Test.z PrintFloat
}

export int Main{
    5 2 123.5f = Test
    PrintTest
    1.5f := j
    loop{
        1.1f += j
        j PrintFloat
        j 5f > if{
            break
        }
    }
    2
}`;

Compiler(code);
