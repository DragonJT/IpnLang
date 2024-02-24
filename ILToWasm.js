import Emitter from './Emitter.js';

function ILToWasm(functions, importFunctions){
    var id = 0;
    for(var f of importFunctions){
        f.id = id;
        id++;
    }
    for(var f of functions){
        f.id = id;
        id++;
    }

    function EmitFunctionWasm(func){
        var id = 0;
        for(var p of func.parameters){
            p.id = id;
            id++;
        }
        var ints = [];
        for(var l of func.locals){
            if((l.type == 'int') || (l.type == 'bool')){
                ints.push(l);
            }
            else{
                throw "Unexpected type: "+JSON.stringify(l);
            }
        }

        var localBytes = [];
        for(var i of ints){
            i.id = id;
            id++;
        }
        if(ints.length > 0){
            localBytes.push(Emitter.encodeLocal(ints.length, Emitter.Valtype.i32));
        }

        var wasm = [];
        for(var command of func.il){
            if(command.type == 'call'){
                wasm.push(Emitter.Opcode.call, ...Emitter.unsignedLEB128(command.value.id));
            }
            else if(command.type == 'get_local'){
                wasm.push(Emitter.Opcode.get_local, ...Emitter.unsignedLEB128(command.value.id));
            }
            else if(command.type == 'if'){
                wasm.push(Emitter.Opcode.if, Emitter.Blocktype.void);
            }
            else if(command.type == 'loop'){
                wasm.push(Emitter.Opcode.block, Emitter.Blocktype.void);
                wasm.push(Emitter.Opcode.loop, Emitter.Blocktype.void);
            }
            else if(command.type == 'br'){
                wasm.push(Emitter.Opcode.br, ...Emitter.unsignedLEB128(command.value));
            }
            else if(command.type == 'const_int'){
                wasm.push(Emitter.Opcode.i32_const, ...Emitter.signedLEB128(command.value));
            }
            else if(command.type == 'end_if'){
                wasm.push(Emitter.Opcode.end);
            }
            else if(command.type == 'end_loop'){
                wasm.push(Emitter.Opcode.br, 0, Emitter.Opcode.end, Emitter.Opcode.end);
            }
            else if(command.type == '+'){
                wasm.push(Emitter.Opcode.i32_add);
            }
            else if(command.type == '*'){
                wasm.push(Emitter.Opcode.i32_mul);
            }
            else if(command.type == '/'){
                wasm.push(Emitter.Opcode.i32_div);
            }
            else if(command.type == '-'){
                wasm.push(Emitter.Opcode.i32_sub);
            }
            else if(command.type == '<'){
                wasm.push(Emitter.Opcode.i32_lt);
            }
            else if(command.type == '>'){
                wasm.push(Emitter.Opcode.i32_gt);
            }
            else if(command.type == '+='){
                var localIDBytes = Emitter.unsignedLEB128(command.value.id);
                wasm.push(Emitter.Opcode.get_local, ...localIDBytes);
                wasm.push(Emitter.Opcode.i32_add);
                wasm.push(Emitter.Opcode.set_local, ...localIDBytes);
            }
            else if(command.type == '='){
                wasm.push(Emitter.Opcode.set_local, ...Emitter.unsignedLEB128(command.value.id));
            }
            else if(command.type == ':='){
                wasm.push(Emitter.Opcode.set_local, ...Emitter.unsignedLEB128(command.value.id));
            }
            else{
                throw "FunctionWasm: Unexpected token: "+JSON.stringify(command);
            }
        }

        return [...Emitter.encodeVector(localBytes), ...wasm, Emitter.Opcode.end];
    }


    function EmitTypeSection(){
        function GetValtype(typeName){
            switch(typeName){
                case 'float': return Emitter.Valtype.f32;
                case 'int': return Emitter.Valtype.i32;
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
                Emitter.functionType,
                ...Emitter.encodeVector(f.parameters.map(p=>GetValtype(p.type))),
                ...Emitter.encodeVector(GetReturnArray(f.returnType)),
            ]);
        }
        return Emitter.createSection(Emitter.Section.type, Emitter.encodeVector([...EmitTypes(importFunctions), ...EmitTypes(functions)]));
    }

    function EmitImportSection(){
        function EmitImportFunctions(){
            return importFunctions.map((f,i)=>[
                ...Emitter.encodeString("env"),
                ...Emitter.encodeString(f.name),
                Emitter.ExportType.func,
                ...Emitter.unsignedLEB128(i)
            ]);
        }

        return Emitter.createSection(Emitter.Section.import, Emitter.encodeVector([...EmitImportFunctions(), Emitter.memoryImport]));
    }

    function EmitFuncSection(){
        return Emitter.createSection(Emitter.Section.func, Emitter.encodeVector(functions.map(f=>Emitter.unsignedLEB128(f.id))));
    }

    function EmitExportSection(){
    return Emitter.createSection(
        Emitter.Section.export,
        Emitter.encodeVector(functions
                .filter(f=>f.export)
                .map(f=>[...Emitter.encodeString(f.name), Emitter.ExportType.func, ...Emitter.unsignedLEB128(f.id)])),
        );
    }

    function EmitCodeSection(){
        return Emitter.createSection(Emitter.Section.code, Emitter.encodeVector(functions.map(f=>Emitter.encodeVector(EmitFunctionWasm(f)))));
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
        ...Emitter.magicModuleHeader,
        ...Emitter.moduleVersion,
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

export default ILToWasm;