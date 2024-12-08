#!/bin/bash

./network.sh down
docker stop $(docker ps -q)
docker rm $(docker ps -a -q)
docker volume rm $(docker volume ls -q)


./network.sh up -ca
./network.sh createChannel 

./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go 