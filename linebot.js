var line = require('@line/bot-sdk');

var underscore = require('underscore');
var underscoreString = require("underscore.string");
var request = require('request');
var qs = require('querystring');

var applicationName = "spotgacha_linebot";
var userStatusEnum = {
  follow: 0,
  unfollow: 1,
}

var apiRequests = {
  hotpepper: "http://webservice.recruit.co.jp/hotpepper/gourmet/v1/",
  gnavi: "https://api.gnavi.co.jp/RestSearchAPI/20150630/",
  google_place: "https://maps.googleapis.com/maps/api/place/nearbysearch/output?parameters",
  yelp: "https://api.yelp.com/v3/"
};

var DynamoDB = require(__dirname + '/dynamodb.js');
var dynamodb = new DynamoDB();

var requestHotpepper = function(searchObj) {
  var request_params = {
    format: "json",
    key: process.env.RECRUIT_APIKEY,
    datum: "world",
    count: 100
  }
  if(searchObj.latitude && searchObj.longitude){
    request_params.range = searchObj.range;
    request_params.lat = searchObj.latitude;
    request_params.lng = searchObj.longitude;
  }
  if(searchObj.keyword){
    request_params.keyword = searchObj.keyword;
  }
  return new Promise((resolve, reject) => {
    request({url: apiRequests.hotpepper, qs: request_params, json: true }, function(err, res, body) {
      if (error) {
        reject(error);
        return;
      }
      resolve(res, body);
    });
  });
};

var requestGnavi = function(searchObj) {
  var request_params = {
    range: 3,
    format: "json",
    keyid: process.env.GNAVI_APIKEY,
    input_coordinates_mode: 2,
    coordinates_mode: 2,
    latitude: latitude,
    longitude: longitude,
    hit_per_page: 100
    //offset: 1,
    //no_smoking: 1,
    //mobilephone: 1,
    //parking: 1,
    //deliverly 1 デリバリーあり
    //special_holiday_lunch: 1 土日特別ランチあり 0
    //breakfast: 1
    //until_morning: 1
  };
  //  if (7..10).cover?(now.hour)
  //  #朝食をやっているか
  //  request_hash[:breakfast] = 1
  //elsif (14..16).cover?(now.hour)
  //  #遅めのランチをやっているか
  //  request_hash[:late_lunch] = 1
  //elsif (3..5).cover?(now.hour)
  //  #朝までやっているか
  //  request_hash[:until_morning] = 1
  //end
  return new Promise((resolve, reject) => {
    request({url: apiRequests.gnavi, qs: request_params, json: true }, function(error, res, body) {
      if (error) {
        reject(error);
        return;
      }
      resolve(res, body);
    });
  })
};

//range	検索範囲	ある地点からの範囲内のお店の検索を行う場合の範囲を5段階で指定できます。たとえば300m以内の検索ならrange=1を指定します	1: 300m
//2: 500m
//3: 1000m (初期値)
//4: 2000m
//5: 3000m
//携帯クーポン掲載	携帯クーポンの有無で絞り込み条件を指定します。		1：携帯クーポンなし
//0：携帯クーポンあり
//指定なし：絞り込みなし
//lunch	ランチあり	「ランチあり」という条件で絞り込むかどうかを指定します。	 	0:絞り込まない（初期値）
//1:絞り込む
//midnight	23時以降も営業	「23時以降も営業」という条件で絞り込むかどうかを指定します。	 	0:絞り込まない（初期値）
//1:絞り込む
//midnight_meal	23時以降食事OK	「23時以降食事OK」という条件で絞り込むかどうかを指定します。	 	0:絞り込まない（初期値）
//1:絞り込む
//    count	1ページあたりの取得数	検索結果の最大出力データ数を指定します。	 	初期値：10、最小1、最大100
//format	レスポンス形式	レスポンスをXMLかJSONかJSONPかを指定します。JSONPの場合、さらにパラメータ callback=コールバック関数名 を指定する事により、javascript側コールバック関数の名前を指定できます。	 	初期値:xml。xml または json または jsonp。
//genre	お店ジャンルコード	お店のジャンル(サブジャンル含む)で絞込むことができます。指定できるコードについてはジャンルマスタAPI参照	 	*2
//food	料理コード	料理（料理サブを含む)で絞りこむことができます。指定できるコードについては料理マスタAPI参照	 	5個まで指定可。*2
//budget	検索用予算コード	予算で絞り込むことができます。指定できるコードについては予算マスタAPI参照	 	2個まで指定可。*2

var lotRestaurant = function(latitude, longitude) {
  var requestResults = [];
  return requestHotpepper({latitude: latitude, longitude: longitude}).then(function(hotpepperResults) {
    for(var i = 0;i < hotpepperResults.length;++i){
      requestResults.push(hotpepperResults[i]);
    }
    return requestGnavi(latitude, longitude);
  }).then(function(gnaviResults) {
    return new Promise((resolve, reject) => {
      for(var i = 0;i < gnaviResults.length;++i){
        requestResults.push(gnaviResults[i]);
      }
      resolve(underscore.sample(requestResults, 10));
    });
  });
}

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
      return lotRestaurant(lineMessageObj.message.latitude, lineMessageObj.message.longitude).then(function(searchResult){
        var insertObject = {
          message_id: lineMessageObj.message.id,
          user_id: lineMessageObj.source.userId,
          reply_token: lineMessageObj.replyToken,
          applicationName: applicationName,
          input_text: lineMessageObj.message.title,
          input_location: {
            latitude: lineMessageObj.message.latitude,
            longitude: lineMessageObj.message.longitude,
            address: lineMessageObj.message.longitude
          },
          created_at: lineMessageObj.timestamp
        }
        return dynamodb.createPromise("bot_messages", insertObject);
      }).then(function(searchResult){
        return new Promise((resolve, reject) => {
          var messageObj = {
            type: "template",
            altText: lineMessageObj.text + "の検索結果",
            template: {
              type: "carousel",
              columns: underscore.map(resultSamples, function(video){
                return {
                  thumbnailImageUrl: video.thumb,
                  title: underscoreString(video.title).prune(37).value(),
                  text: "再生時間:" + video.duration.toString(),
                  defaultAction: {
                    type: "uri",
                    label: "動画を見る",
                    uri: video.url
                  },
                  actions: [
                    {
                      type: "uri",
                      label: "動画を見る",
                      uri: video.url
                    }
                  ]
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