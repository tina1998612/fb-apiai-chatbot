'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const APIAI_TOKEN = process.env.APIAI_TOKEN;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const apiai = require('apiai');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});

/* For Facebook Validation */
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] && req.query['hub.verify_token'] === 'fb_verify_token') {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).end();
  }
});

let restUrl = "http://api-anna.azurewebsites.net/api";
var text;
var sender;
var reply_json = {};
var first = true;
/* Handling all messenges */
app.post('/webhook', (req, res) => {
  if (req.body.object === 'page') {
    req.body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        if (event.message && event.message.text) {
          sender = event.sender.id;
          text = event.message.text;
          sendMessage(event);
        }
        if(event.postback && event.postback.payload){
          var groupid = event.postback.payload.slice(1);
          if(event.postback.payload[0] == 'j'){
            console.log('Intent: join_group');
            request.put({url: restUrl+ "/joinGroup", form: {
              "facebookid": sender,
              "groupid": groupid
            }}, function(err, res, body){ 
              if(!err){
                console.log(sender + " join " + groupid + " successfully!");
                reply_json = {};
                show_options();
                sendMessage(" ");
              } else {
                return console.error('Error on join group: ', err);
              }
            });
          } else if(event.postback.payload[0] == 'l'){
            console.log('Intent: leave_group');

            request.put({url: restUrl+ "/leaveGroup", form: {
              "facebookid": sender,
              "groupid": groupid
            }}, function(err, res, body){ 
              if(!err){
                console.log(sender + " leave " + groupid + " successfully!");
                reply_json = {};
                show_options();
                sendMessage(" ");
              } else {
                return console.error('Error on leave group: ', err);
              }
            });
          } else if(event.postback.payload == "show groups"){
            sendMessage("show groups");
          } else if(event.postback.payload == "create groups"){
            sendMessage("create groups");
          }
        }
      });
    });
    res.status(200).end();
  }
});

/* GET query from API.ai */
const apiaiApp = apiai('ae0e8abffbda4ad4844ac1bd52b5c1b2');

function reply(res, message){
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: 'EAADsSpqJodUBAOo6Wg8DiFnohv6vzRWuA3UruN36WUHhtPnzVzaWJKlhR1a7ak4x4gFJxdZCFs4s1txEMb8UuuwmE7A0kCZAiqUJzjw2omBstfGOrSZArCzCdfFzN7XDczHYDSN5ZAebagDgL3be9XUknYdRjNo38FM15BwQ1wZDZD'},
    method: 'POST',
    json: {
      recipient: {id: sender},
      message: message
    }
  }, (error, res) => {
    if (error) {
        console.log('Error sending message: ', error);
    } else if (res.body.error) {
        console.log('Error: ', res.body.error);
    }
  });
}

function sendMessage(event) {

  var apiai = apiaiApp.textRequest(text, {
    sessionId: 'user1'
  });
  text = "default";

  apiai.on('response', function(res) {
    //console.log(res.result.fulfillment);
    var reply_text;
    if(reply_json!={}) reply_text = res.result.fulfillment.speech;
    if(reply_text == undefined) reply_text = (res.result.fulfillment.messages[0]).speech;
    //console.log(reply_text);
    console.log(reply_json);

    if(reply_json.attachment == undefined) reply_json.text = reply_text;
    reply(res, reply_json);
    reply_json = {};
});

  apiai.on('error', (error) => {
    console.log(error);
  });

  apiai.end();
}
function UndefinedIntent(res){
  let errorMessage = "sry I can't get it D:";
        return res.json({
          status:{
            code: 400,
            errorType: errorMessage
          }
        });
}
function show_options(){
  reply_json.quick_replies = [
    {
      "content_type":"text",
      "title":"show groups",
      "payload":"show groups"
    },
    {
      "content_type":"text",
      "title":"create groups",
      "payload":"create groups"
    }
  ]
}

app.post('/ai', (req, res) => {
  let action = req.body.result.action;
  
  if(action === "default"){
    console.log("Intent: default");
    show_options();
  }
  else if (action === 'input.welcome') {
    console.log('Intent: welcome');
    
    request.get(restUrl + '/user', (err, response, body) => {
      if (!err && req.body.result.actionIncomplete == false){
        if(first){
          request.post({url: restUrl+ "/createUser", form: {
            "facebookid": sender,
            "name": req.body.result.parameters.name
          }}, function(err, res, body){ 
            if(!err){
              console.log("create user successful");
              show_options();
            } else {
              return console.error('Error on create_user: ', err);
            }
          });
          first = false;
        }
        else{
          show_options();
        }
        
      } else {
        UndefinedIntent(res);
      }
    })
  }
  else if (action === 'get_group_info') {
    console.log('Intent: get_group_info');
 
    request.get(restUrl + '/getGroups', (err, response, body) => {
      if (!err) {
        let json = JSON.parse(body);
        var elements = [];
        for(var i=0;i<4;i++){
          elements.push({
            "title": json[i].name,
            "subtitle": "See all our colors",
            "image_url": "http://i.imgur.com/P9q4Gas.jpg", 
            "buttons": [
                {
                    "title": "join " + json[i].name,
                    "type": "postback",
                    "payload": "j" + json[i]._id                       
                }
            ]
          });
        }
        console.log("attachment created");
        reply_json.attachment = {
          "type": "template",
          "payload": {
              "template_type": "list",
              "elements": elements
            }
        };
      } else {
        UndefinedIntent(res);
      }
    });
  }
  else if (action === 'create_groups') {
    console.log('Intent: create groups');
 
    request.get(restUrl + '/createGroup', (err, response, body) => {
      if (!err && req.body.result.actionIncomplete == false) {
        request.post({url: restUrl+ "/createGroup", form: {
          "owner": sender,
          "name": req.body.result.parameters.group
        }}, function(err, res, body){ 
          if(!err){
            console.log("create group successfully!");
            show_options();
            sendMessage(" ");
          } else {
            return console.error('Error on create_user: ', err);
          }
        });
        
      } else {
        UndefinedIntent(res);
      }
    });
  }
});
