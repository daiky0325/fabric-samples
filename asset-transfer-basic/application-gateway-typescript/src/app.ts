/*
* Copyright IBM Corp. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*/

import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TextDecoder } from 'util';

    
async function main(): Promise<void> {     
    await setupOrg(1);  
    await setupOrg(2);  
    await setupOrg(3);  
}
interface Asset{
    ID:             string,
    Color:          string,
    Size:           number,
    Owner:          string,
    AppraisedValue: number,
}


function channelName(org:number) { 
    return envOrDefault('CHANNEL_NAME', `org${org}`);
}

const chaincodeName = envOrDefault('CHAINCODE_NAME', 'basic');
const utf8Decoder = new TextDecoder();
const assetId = `asset${String(Date.now())}`;
function getMspId (org:number){
    return envOrDefault('MSP_ID', `Org${org}MSP`);
}


// Path to crypto materials.
function cryptoPath(org:number){
    return  path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', `org${org}.example.com`)
}


// Path to user private key directory.
function keyDirectoryPath(org:number){
    return envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath(org), 'users', `User1@org${org}.example.com`, 'msp', 'keystore'))
}


// Path to user certificate directory.

function certDirectoryPath(org:number){
return envOrDefault('CERT_DIRECTORY_PATH', path.resolve(cryptoPath(org), 'users', `User1@org${org}.example.com`, 'msp', 'signcerts'));
}
// Path to peer tls certificate.
function tlsCertPath(org:number){ return  envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath(org), 'peers', `peer0.org${org}.example.com`, 'tls', 'ca.crt'));
}
// Gateway peer endpoint.
function peerEndpoint (org:number){
    const port=(org-1)*2000+7051;
    return envOrDefault('PEER_ENDPOINT', `localhost:${port}`);
}

// Gateway peer SSL host name override.
function peerHostAlias(org:number) { 
    return envOrDefault('PEER_HOST_ALIAS', `peer0.org${org}.example.com`);
}





async function setupOrg(orgNum:number): Promise<void> {
    // displayInputParameters();
    const client = await newGrpcConnection(orgNum);

    const gateway=connect({
        client,
        identity: await newIdentity(orgNum),
        signer: await newSigner(orgNum),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },});

        // 5. リスナーを登録する
        
        try {
        const network = gateway.getNetwork(channelName(orgNum));
        
        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);

        // await contract.

        console.log(`${orgNum}スタート`)
        const events=await network.getChaincodeEvents(chaincodeName)
        console.log("owari")

    for await (const event of events) {
    try {
        console.log(`Event Name: ${event.transactionId}`);
        
        // イベントのペイロードをデコード
        const payload = event.payload;
        const asset = JSON.parse(new TextDecoder('utf-8').decode(payload)) as Asset;
        console.log(`Asset ID: ${asset.ID}`);
        
        // mychannel の設定・送信
        const myChannelNetwork = gateway.getNetwork('mychannel');
        const myChannelContract = myChannelNetwork.getContract(chaincodeName);
        
        // アセットを作成
        await createAsset(myChannelContract, asset);
        console.log("アセット作成が完了しました");
    } catch (eventError) {
        console.error(`イベント処理中にエラーが発生しました: ${eventError}`);
    }
}
        // Initialize a set of asset data on the ledger using the chaincode 'InitLedger' function.
        await initLedger(contract);

        // Return all the current assets on the ledger.
        await getAllAssets(contract);

        // Create a new asset on the ledger.

        // Update an existing asset asynchronously.
        await transferAssetAsync(contract);

        // Get the asset details by assetID.
        await readAssetByID(contract);

        // Update an asset which does not exist.
        await updateNonExistentAsset(contract)
    }catch (error) {
        console.error(`Error listening for events: ${error}`);
    } 
    finally{
        gateway.close();
        client.close();
    }
    }

main().catch((error: unknown) => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});

async function newGrpcConnection(org:number): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath(org));
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint(org), tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias(org),
    });
}

async function newIdentity(org:number): Promise<Identity> {
    const certPath = await getFirstDirFileName(certDirectoryPath(org));
    const credentials = await fs.readFile(certPath);
    const mspId=getMspId(org);
    return { mspId, credentials };
}

async function getFirstDirFileName(dirPath: string): Promise<string> {
    const files = await fs.readdir(dirPath);
    const file = files[0];
    if (!file) {
        throw new Error(`No files in directory: ${dirPath}`);
    }
    return path.join(dirPath, file);
}

async function newSigner(org:number): Promise<Signer> {
    const keyPath = await getFirstDirFileName(keyDirectoryPath(org));
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * This type of transaction would typically only be run once by an application the first time it was started after its
 * initial deployment. A new version of the chaincode deployed later would likely not need to run an "init" function.
 */
async function initLedger(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');

    await contract.submitTransaction('InitLedger');

    console.log('*** Transaction committed successfully');
}

/**
 * Evaluate a transaction to query ledger state.
 */
async function getAllAssets(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');

    const resultBytes = await contract.evaluateTransaction('GetAllAssets');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

/**
 * Submit a transaction synchronously, blocking until it has been committed to the ledger.
 */
async function createAsset(contract: Contract,asset:Asset): Promise<void> {
    console.log('\n--> Submit Transaction: CreateAsset, creates new asset with ID, Color, Size, Owner and AppraisedValue arguments');

    await contract.submitTransaction(
        'CreateAsset',
        asset.ID,
        asset.Color,
        asset.Size.toString(),
        asset.Owner,
        asset.AppraisedValue.toString(),
    );

    console.log('*** Transaction committed successfully');
}

/**
 * Submit transaction asynchronously, allowing the application to process the smart contract response (e.g. update a UI)
 * while waiting for the commit notification.
 */
async function transferAssetAsync(contract: Contract): Promise<void> {
    console.log('\n--> Async Submit Transaction: TransferAsset, updates existing asset owner');

    const commit = await contract.submitAsync('TransferAsset', {
        arguments: [assetId, 'Saptha'],
    });
    const oldOwner = utf8Decoder.decode(commit.getResult());

    console.log(`*** Successfully submitted transaction to transfer ownership from ${oldOwner} to Saptha`);
    console.log('*** Waiting for transaction commit');

    const status = await commit.getStatus();
    if (!status.successful) {
        throw new Error(`Transaction ${status.transactionId} failed to commit with status code ${String(status.code)}`);
    }

    console.log('*** Transaction committed successfully');
}

async function readAssetByID(contract: Contract): Promise<void> {
    console.log('\n--> Evaluate Transaction: ReadAsset, function returns asset attributes');

    const resultBytes = await contract.evaluateTransaction('ReadAsset', assetId);

    const resultJson = utf8Decoder.decode(resultBytes);
    const result: unknown = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

/**
 * submitTransaction() will throw an error containing details of any error responses from the smart contract.
 */
async function updateNonExistentAsset(contract: Contract): Promise<void>{
    console.log('\n--> Submit Transaction: UpdateAsset asset70, asset70 does not exist and should return an error');

    try {
        await contract.submitTransaction(
            'UpdateAsset',
            'asset70',
            'blue',
            '5',
            'Tomoko',
            '300',
        );
        console.log('******** FAILED to return an error');
    } catch (error) {
        console.log('*** Successfully caught the error: \n', error);
    }
}

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
// function displayInputParameters(): void {
//     console.log(`channelName:       ${channelName}`);
//     console.log(`chaincodeName:     ${chaincodeName}`);
//     // console.log(`mspId:             ${mspId}`);
//     console.log(`cryptoPath:        ${cryptoPath}`);
//     console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
//     console.log(`certDirectoryPath: ${certDirectoryPath}`);
//     console.log(`tlsCertPath:       ${tlsCertPath}`);
//     console.log(`peerEndpoint:      ${peerEndpoint}`);
//     console.log(`peerHostAlias:     ${peerHostAlias}`);
// }