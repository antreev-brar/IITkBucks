var express =require("express");
var bodyParser =require("body-parser");
var fs = require('fs');
var request = require('request');
var app = express();
app.use(bodyParser.json({extended: false }));

var potentialPeers=["http://localhost:8787/newPeer"];
var peers =[]
var max_peers_length = 3

function fill_peer_list(){
    var i=0;
    while (1) { 
        console.log(i);
        if(i >= potentialPeers.length){console.log('potential peers exhausted');break;}
        if(peers.length>=max_peers_length){console.log('max peers length reached');break;}
        request.post(
            {
            url:potentialPeers[0],

            json: {
                    "url":"4th peer",
                 },
             headers: {
                    'Content-Type': 'application/json'
                }
            },
        function(error, response, body){
            
              console.log("error  :" +error);
              console.log("response == "+response.statusCode);
              console.log("host == "+JSON.stringify(response.request.uri.host));
              //console.log(JSON.stringify(response));
              if (response.statusCode== 500){
              console.log(`node ${response.request.uri.host} didnt add me as a peer`);
              console.log(JSON.stringify(body));
              
              //console.log(typeof body);
              list = JSON.parse(JSON.stringify(body));
              for (var j=0;j<list.length;j++){
                    if (potentialPeers.indexOf(list[j])== -1){
                            potentialPeers.push(list[j]);
                            console.log('adding '+list[j]);
                            console.log('potential peer length :'+ potentialPeers.length);
                         }
                    }
              console.log(potentialPeers);
              console.log(list.length);
            }
            if(response.statusCode==200){
                console.log('node'+JSON.stringify(response.request.uri.host) +'added me as a peer , i should too');
                peers.push(response.request.uri.host);
            }
            console.log('inside function request')
        });
        console.log(potentialPeers);
     i++;
    }
    console.log('printing '+potentialPeers);
}


app.get('/',(req,res,next)=>{
    fill_peer_list();
    //potentialPeers.push(list);
    //var l = JSON.parse(JSON.stringify(list));;
    
    console.log(potentialPeers+'-------');
    res.send('done');
});
app.get('/getPotentialPeers',(req,res,next)=>{
    
    //res.send(potentialPeers.length);
    console.log(potentialPeers);
    res.sendStatus(200);
});

const port =8000
app.listen(port,function(error){

    if(error){
        console.log("this thing is fucked")
    } else{
        console.log('server listening on port '+port)
    }
})
