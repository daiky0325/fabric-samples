#!/bin/bash

./network.sh down
docker volume rm $(docker volume ls -q)docker volume rm $(docker volume ls -q)

./network.sh up
./network.sh createChannel 
./network.sh createChannel -org 1 -c "org1" 
./network.sh createChannel -org 2 -c "org2" 
./network.sh createChannel -org 3 -c "org3" 

./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go 
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go -c "org1" -org 1
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go -c "org2" -org 2
./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go -c "org3" -org 3