var line = require('@line/bot-sdk');

var AWS = require('aws-sdk');
AWS.config.update({
  region: 'ap-northeast-1',
});
var dynamo = new AWS.DynamoDB.DocumentClient();
var underscore = require('underscore');
var underscoreString = require("underscore.string");
var request = require('request');
var qs = require('querystring');

var applicationName = "spotgacha_linebot";
var userStatusEnum = {
  follow: 0,
  unfollow: 1,
}

var lineClient;

var apiRequests = {
  hotpepper: "http://webservice.recruit.co.jp/hotpepper/gourmet/v1/",
  gnavi: "https://api.gnavi.co.jp/RestSearchAPI/20150630/",
  google_place: "https://maps.googleapis.com/maps/api/place/nearbysearch/output?parameters",
  yelp: "https://api.yelp.com/v3/"
};

var requestHotpepper = function(latitude, longitude) {
  var request_params = {
    range: 3,
    format: "json",
    key: process.env.RECRUIT_APIKEY,
    lat: latitude,
    lng: longitude,
    datum: "world",
    count: 100
  }
  return new Promise((resolve, reject) => {
    request({url: apiRequests.hotpepper + '?' + qs.stringify(request_params), json: true }, function(err, res, body) {
      if (error) {
        reject(error);
        return;
      }
      resolve(res, body);
    });
  });
};

var requestGnavi = function(latitude, longitude) {
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
    request({url: apiRequests.gnavi + '?' + qs.stringify(request_params), json: true }, function(error, res, body) {
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
  return requestHotpepper(latitude, longitude).then(function(hotpepperResults) {
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

var getDynamodbPromise = function(tablename, filterObject){
  return new Promise((resolve, reject) => {
    var params = {
      TableName: tablename,
      Key: filterObject
    };
    dynamo.get(params, function(error, data) {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
};

var updateDynamodbPromise = function(tablename, filterObject, updateObject){
  return new Promise((resolve, reject) => {
    var updateExpressionString = "set ";
    var updateExpressionAttributeValues = {}
    var keys = Object.keys(updateObject);
    for(var i = 0;i < keys.length;++i){
      var praceholder = ":Attr" + i.toString();
      updateExpressionString = updateExpressionString + keys[i] + " = " + praceholder;
      if(i != keys.length - 1){
        updateExpressionString = updateExpressionString + ", ";
      }
      updateExpressionAttributeValues[praceholder] = updateObject[keys[i]];
    }
    var params = {
      TableName: tablename,
      Key: filterObject,
      UpdateExpression: updateExpressionString,
      ExpressionAttributeValues: updateExpressionAttributeValues,
      ReturnValues:"UPDATED_NEW"
    };
    dynamo.update(params, function(error, data) {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
};

var createDynamodbPromise = function(tablename, putObject){
  var params = {
    TableName: tablename,
    Item: putObject
  };
  return new Promise((resolve, reject) => {
    var params = {
      TableName: tablename,
      Item: putObject
    };
    dynamo.put(params, function(error, data) {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
};

var getUserProfile = function(user_id){
  return lineClient.getProfile(user_id);
}

exports.follow = function(user_id, timestamp) {
  var userProfileObj = {userId: user_id};
  return getUserProfile(user_id).then(function(profile){
    userProfileObj = Object.assign(userProfileObj, profile);
    return getDynamodbPromise("users", {user_id: user_id});
  }).then(function(userData){
    if(userData.Item){
      var updateObject = {
        updated_at: timestamp
      }
      updateObject[applicationName] = userStatusEnum.follow
      return updateDynamodbPromise("users", {user_id: user_id}, updateObject);
    }else{
      var insertObject = {
        user_id: userProfileObj.userId,
        name: userProfileObj.displayName,
        icon_url: userProfileObj.pictureUrl,
        description: userProfileObj.statusMessage,
        updated_at: timestamp
      }
      insertObject[applicationName] = userStatusEnum.follow
      return createDynamodbPromise("users", insertObject);
    }
  });
}

exports.unfollow = function(user_id, timestamp) {
  return getDynamodbPromise("users", {user_id: user_id}).then(function(userData){
    if(userData.Item){
      var updateObject = {
        updated_at: timestamp
      }
      updateObject[applicationName] = userStatusEnum.unfollow
      return updateDynamodbPromise("users", {user_id: user_id}, updateObject);
    }
  });
}

exports.initLineClient = function(accessToken) {
  lineClient = new line.Client({channelAccessToken: accessToken});
  return lineClient;
}

exports.searchRestaurant = function(lineMessageObj) {
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
      return createDynamodbPromise("bot_messages", insertObject);
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