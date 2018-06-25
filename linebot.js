var line = require('@line/bot-sdk');

var Restaurant = require(__dirname + '/restaurant.js');
var restaurant = new Restaurant();

var underscore = require('underscore');
var underscoreString = require("underscore.string");

var applicationName = "spotgacha_linebot";
var userStatusEnum = {
  follow: 0,
  unfollow: 1,
}

var DynamoDB = require(__dirname + '/dynamodb.js');
var dynamodb = new DynamoDB();

var LineBot = function(accessToken){
  this.lineClient = new line.Client({channelAccessToken: accessToken});

  this.getUserProfile = function(user_id){
    return this.lineClient.getProfile(user_id);
  }

  this.follow = function(user_id, timestamp) {
    var userProfileObj = {userId: user_id};
    return this.getUserProfile(user_id).then(function(profile){
      userProfileObj = Object.assign(userProfileObj, profile);
      return dynamodb.getPromise("users", {user_id: user_id});
    }).then(function(userData){
      if(userData.Item){
        var updateObject = {
          updated_at: timestamp
        }
        updateObject[applicationName] = userStatusEnum.follow
        return dynamodb.updatePromise("users", {user_id: user_id}, updateObject);
      }else{
        var insertObject = {
          user_id: userProfileObj.userId,
          name: userProfileObj.displayName,
          icon_url: userProfileObj.pictureUrl,
          description: userProfileObj.statusMessage,
          updated_at: timestamp
        }
        insertObject[applicationName] = userStatusEnum.follow
        return dynamodb.createPromise("users", insertObject);
      }
    });
  }

  this.unfollow = function(user_id, timestamp) {
    return dynamodb.getPromise("users", {user_id: user_id}).then(function(userData){
      if(userData.Item){
        var updateObject = {
          updated_at: timestamp
        }
        updateObject[applicationName] = userStatusEnum.unfollow
        return dynamodb.updatePromise("users", {user_id: user_id}, updateObject);
      }
    });
  }

  this.searchRestaurant = function(lineMessageObj) {
    if(lineMessageObj.message.type == "location"){
      var resultSamples = []
      return restaurant.lotRestaurant(lineMessageObj.message.latitude, lineMessageObj.message.longitude).then(function(searchResult){
        var insertObject = {
          message_id: lineMessageObj.message.id,
          message_type: lineMessageObj.message.type,
          user_id: lineMessageObj.source.userId,
          reply_token: lineMessageObj.replyToken,
          application_name: applicationName,
          input_text: lineMessageObj.message.title,
          input_location: {
            latitude: lineMessageObj.message.latitude,
            longitude: lineMessageObj.message.longitude,
            address: lineMessageObj.message.address
          },
          response_object: searchResult,
          created_at: lineMessageObj.timestamp
        }
        return dynamodb.createPromise("bot_messages", insertObject);
      }).then(function(searchResult){
        return new Promise((resolve, reject) => {
          var messageObj = {
            type: "template",
            altText: "お店の候補はこちら!!",
            template: {
              type: "carousel",
              columns: underscore.map(searchResult, function(restaurant){
                //TODO Use Flex Message
                var carouselActions = []
                if(restaurant.url){
                  carouselActions.push({
                    type: "uri",
                    label: "詳細を見る",
                    uri: restaurant.url
                  });
                }
                if(restaurant.id){
                  carouselActions.push({
                    type: "postback",
                    label: "場所を知りたい",
                    data: JSON.stringify({type: "showLocation", restaurantId: restaurant.id})
                  });
                }
                if(restaurant.phone_number){
                  carouselActions.push({
                    type: "uri",
                    label: "予約する",
                    uri: "tel:" + restaurant.phone_number,
                  });
                }
                if(restaurant.coupon_url){
                  carouselActions.push({
                    type: "uri",
                    label: "クーポンを使う",
                    uri: restaurant.coupon_url
                  });
                }
                return {
                  thumbnailImageUrl: restaurant.icon_url,
                  title: restaurant.place_name,
                  text: restaurant.place_description,
                  actions: carouselActions.slice(0,3),
                }
              })
            }
          };
          resolve(messageObj);
        });
      });
    }
    return null;
  }

  this.linkRichMenu = function(userId, richMenuId){
    return this.lineClient.linkRichMenuToUser(userId, richMenuId)
  }

  this.unlinkRichMenu = function(userId){
    return this.lineClient.unlinkRichMenuFromUser(userId)
  }

  this.createRichmenu = function(){
    return this.lineClient.createRichMenu({
      size:{
        width:2500,
        height:843
      },
      selected: true,
      name: "HiwaiHubController",
      chatBarText: "オプション",
      areas:[
        {
          bounds:{
            x:0,
            y:0,
            width:2500,
            height:443
          },
          action:{
            type: "uri",
            label: "本家PronHubに行く",
            uri: "https://www.pornhub.com/"
          }
        },
        {
          bounds:{
            x:0,
            y:443,
            width:833,
            height:400
          },
          action:{
            type: "uri",
            label: "仮想通貨Vergeを購入する",
            uri: "https://www.binance.com/?ref=16721878"
          }
        },
        {
          bounds:{
            x:834,
            y:443,
            width:833,
            height:400
          },
          action:{
            type: "uri",
            label: "日本円でBitCoinを購入する",
            uri: "https://bitflyer.jp?bf=3mrjfos1"
          }
        },
        {
          bounds:{
            x:1667,
            y:443,
            width:833,
            height:400
          },
          action:{
            type: "message",
            label: "Vergeで寄付する",
            text: "D6NkyiFL9rvqu8bjaSaqwD9gr1cwQRbiu6"
          }
        }
      ]
    }).then(function(richmenuId){
      console.log(richmenuId);
    }).catch(function(err){
      console.log(err);
      console.log(JSON.stringify(err.originalError.response.data));
    });
  }

  this.setRichmenuImage = function(richMenuId, filePath){
    var fs = require('fs');
    return this.lineClient.setRichMenuImage(richMenuId, fs.readFileSync(filePath));
  }

  this.deleteRichMenu = function(richMenuId){
    return this.lineClient.deleteRichMenu(richMenuId);
  };

  this.getRichMenuList = function(){
    return this.lineClient.getRichMenuList();
  }

  this.isHttpUrl = function(url){
    var pattern = new RegExp('^(https?:\/\/)?' + // protocol
     '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|' + // domain name
     '((\d{1,3}\.){3}\d{1,3}))' + // OR ip (v4) address
     '(\:\d+)?(\/[-a-z\d%_.~+]*)*' + // port and path
     '(\?[;&a-z\d%_.~+=-]*)?' + // query string
     '(\#[-a-z\d_]*)?$','i'); // fragment locater
     return pattern.test(url)
  }
}

module.exports = LineBot;