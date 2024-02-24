function InsertGlobalMemAddressConst(functions){

    function FindIndex(func, type){
        for(var i=0;i<func.il.length;i++){
            if(func.il[i].type == type){
                return i;
            }
        }
        return -1;
    }

    function FindWhereStackNetChangeIs0(func, stackSize, index){
        for(var i=index;i>=0;i--){
            stackSize -= func.il[i].stackIncreaseAmount;
            if(stackSize == 0){
                return i;
            }
        }
        throw "Couldnt find where stack is net 0: "+stackSize;
    }

    function InsertIntoArray(array, index, value){
        array.splice(index, 0, value);
    }

    function InsertGlobalMemAddressConstInFunction(func){
        while(true){
            var index = FindIndex(func, 'set_global');
            if(index>=0){
                var setGlobal = func.il[index];
                console.log('-----------------', setGlobal);
                var index2 = FindWhereStackNetChangeIs0(func, 1, index-1);
                InsertIntoArray(func.il, index2, {type:'global_mem_address_const', stackIncreaseAmount:1, value:setGlobal.value.memLoc});
                setGlobal.type = 'store';
                setGlobal.stackIncreaseAmount = -2;
            } 
            else{
                return;
            }
        }
    }

    for(var func of functions){
        InsertGlobalMemAddressConstInFunction(func);
    }
}

export default InsertGlobalMemAddressConst;