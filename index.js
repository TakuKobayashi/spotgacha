var linebot = require(__dirname + '/linebot.js');

var callLambdaResponse = function(promise, context){
  promise.then((response) => {
    var lambdaResponse = {
      statusCode: 200,
      headers: { "X-Line-Status": "OK"},
      body: JSON.stringify({"result": "completed"})
    };
    context.succeed(lambdaResponse);
  }).catch(function(err){
    console.log(err);
  });
}

exports.handler = function (event, context) {
  console.log(JSON.stringify(event));
  var lineClient = linebot.initLineClient(process.env.ACCESSTOKEN);
  event.events.forEach(function(lineMessage) {
    if(lineMessage.type == "follow"){
      var followPromise = linebot.follow(lineMessage.source.userId, lineMessage.timestamp);
      callLambdaResponse(followPromise, context);
    }else if(lineMessage.type == "unfollow"){
      linebot.unfollow(lineMessage.source.userId, lineMessage.timestamp);
    }else if(lineMessage.type == "postback"){
      var receiveData = JSON.parse(lineMessage.postback.data);
    }else if(lineMessage.type == "message"){
      var replyMessageObjectPromise = linebot.searchRestaurant(lineMessage);
      if(!replyMessageObjectPromise) return;
      callLambdaResponse(replyMessageObjectPromise.then(function(messageObj){
        return lineClient.replyMessage(lineMessage.replyToken, messageObj);
      }), context);
    }
  });
};