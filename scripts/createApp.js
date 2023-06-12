//
// USAGE:
//   node scripts/createApp.js --environment=[local|test|production] --orderbook=[algo|asa] --sender=[sender] --mnemonic=[mnemonic] --saveToDisk=[true|false]

const algosdk = require('algosdk');
const algodex = require('../index.js');
const fs = require('fs');

// user declared account mnemonics

//fund the account below before creating

// declare application state storage (immutable)
localInts = 2;
localBytes = 1;
globalInts = 0;
globalBytes = 1;

// user declared approval program (initial)


// declare clear state program source
clearProgramSource = `#pragma version 2
int 1
`;

// helper function to compile program source  
async function compileProgram(client, programSource) {
    let encoder = new TextEncoder();
    let programBytes = encoder.encode(programSource);
    let compileResponse = await client.compile(programBytes).do();
    let compiledBytes = new Uint8Array(Buffer.from(compileResponse.result, "base64"));
    return compiledBytes;
}

// create new application
async function createApp(client, creatorAccount, approvalProgram, clearProgram, localInts, 
    localBytes, globalInts, globalBytes, saveToDisk=false) {
    // define sender as creator
    sender = creatorAccount.addr;

    // declare onComplete as NoOp
    onComplete = algosdk.OnApplicationComplete.NoOpOC;

	// get node suggested parameters
    const params = await client.getTransactionParams().do();

    // create unsigned transaction
    const txn = algosdk.makeApplicationCreateTxn(sender, params, onComplete, 
                                            approvalProgram, clearProgram, 
                                            localInts, localBytes, globalInts, globalBytes,);
    const txId = txn.txID().toString();

    if (saveToDisk) {
        fs.writeFileSync('./unsigned.txn', algosdk.encodeUnsignedTransaction( txn ));
        console.log("Saved [unsigned.txn] to disk! returning early");
        return -1;
    }
    /*fs.readFile('./unsigned.txn', null, function(err, data) {
         if (err) throw err;
        const arr = new Uint8Array(data);
        console.log(arr.join(','));
    });*/
   
    // Sign the transaction
    const signedTxn = txn.signTxn(creatorAccount.sk);
    console.log("Signed transaction with txID: %s", txId);

    // Submit the transaction
    await client.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    // display results

    const transactionResponse = (await algodex.waitForConfirmation(txId)).transaction;
    const appId = transactionResponse['created-application-index'];
    console.log("Created new app-id: ",appId);
    return appId;
}

 const getCreatorAccount = (mnemonic, fromAddr) => {
    let accountStr = null;
    let account = null;
    if (mnemonic) {
        account = algosdk.mnemonicToSecretKey(mnemonic);
    } else {
        accountStr = fromAddr;
        account = {
            addr: fromAddr,
            sk: null
        }
    }

    if (mnemonic && fromAddr && fromAddr != accountStr) {
        throw 'fromAddr does not match mnemonic addr!';
    }

    return account;
}


async function main() {
    try {
    
        const args = require('minimist')(process.argv.slice(2))
        const environment = args['environment'];
        const orderbook = args['orderbook'];
        const mnemonic = args['mnemonic'];
        const fromAddr = args['sender'];
        const saveToDisk = args['saveToDisk'] === 'true';
        let approvalProgramSourceInitial = null;
        console.log({environment, orderbook, mnemonic});
        // asa or algo
        if (orderbook === 'algo') {
            approvalProgramSourceInitial = algodex.getAlgoOrderBookTeal();
        } else {
            approvalProgramSourceInitial = algodex.getAsaOrderBookTeal();
        }

        // initialize an algodClient
       
        let algodClient = algodex.initAlgodClient(environment);

        let creatorAccount = getCreatorAccount(mnemonic, fromAddr);
        console.log({creatorAccount});
        //create sample token and optin note the switch of accounts
        //useraccount will be the token creator
        //await createToken(algodClient, userAccount, creatorAccount);

        // compile programs 
        let approvalProgram = await compileProgram(algodClient, approvalProgramSourceInitial);
        let clearProgram = await compileProgram(algodClient, clearProgramSource);

        // create new application
        let appId = await createApp(algodClient, creatorAccount, approvalProgram, clearProgram, 
            localInts, localBytes, globalInts, globalBytes, saveToDisk);
        console.log( "APPID="+appId);

    }
    catch (err){
        console.log("err", err);  
    }
}

main();