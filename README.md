# IITkBucks
This repo contains my freshmen year Summer Project , under the Programming club of Science and Technology Council ,IIT Kanpur. 

In this project we built a custom cryptocurrency using a blockchain model. The model can be used for secure transactions that can be verified by anyone without the need of a central body. A major advantage of such a network is that it maintains strict anonymity, as a public key is all that is needed to make a transaction.
The model contains all the major functionalities that exist in Industrial Blockchains like Bitcoin and Etherium

Specifically the repo maintains code of my independent node written in NodeJS Framework implemented as a stand-alone program.

## Usage
Install the dependencies required
```
npm install
```
Run node  
```
node main.js 
```
Interact with the application
```
npm frontend.js
```
Tunnel through ngrok to get a hostname 
[https://ngrok.com]

## Functions

Features present in User Interface :
* Generate your own set of public and private keys 
* Add Alias for account
* Check Balance - Wallet
* Transfer coins

## Takeaway

This the first time i ever had hands-on-experience on a major Project streaching 3 Months. The entire journey was fulfilling and it feels good to have completed it on time. Being a newbie in Web-Dev , the codebase may be somehow difficult to navigate (all backend functions and endpoints written in a single script xP ). Needless to say , now i understand the importance of good-coding practice and hopefully will get better at it soon.

-  **Intro to Web-Dev** - I had to learn about Javascript and NodeJS to implement the entire server application. This entire process was rather challenging as i didn't know about the asynchronous-request-handling nature of javascript beforehand. Now i have gotten somehow well-versed with the Await - Response features to handle them. 

- **Cryptography** - The term Bitcoin and Cryptocurrency have been the Buzzwords in recent years. Learning about what goes behind the scenes was really fun. So far i just know the basics that were essential to make this work and i am excited to dive deeper into the field. 

- **Multi-Threading** - We used multi-threading for worker function that runs in parallel with the HTTP server. It allows the main server to keep running even while mining is underway. The ability of multi-threading is amazing and essential for blockchain. Figuring out how to implement it took a lot of time and google search xD 

- **Understanding peer-to-peer networks** - This project involved creation of a peer-2-peer distributed system of independent nodes , where each server was deployed on laptops and tunneled through ngrok software (free but has limitations on number of requests). Each node would maintain its own ledger and transaction on any server would be propagated to the rest of network. This involved a lot of converting data from one format and another , for processing , mining ,storing , and transferring.

Experiencing your piece of code getting deployed ,interacting with other nodes was all worth it.

## Mentor 
[Priydarshi singh](https://github.com/dryairship)

 
