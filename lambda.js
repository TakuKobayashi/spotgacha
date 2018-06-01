var LineBot = require(__dirname + '/linebot.js');

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
  var linebot = new LineBot(process.env.ACCESSTOKEN);
  var lineClient = linebot.lineClient;
  event.events.forEach(function(lineMessage) {
    if(lineMessage.type == "follow"){
      var followPromise = linebot.follow(lineMessage.source.userId, lineMessage.timestamp);
      callLambdaResponse(followPromise.then(function(){
        //return linebot.linkRichMenu(lineMessage.source.userId, process.env.RICHMENUID1);
      }), context);
    }else if(lineMessage.type == "unfollow"){
      callLambdaResponse(linebot.unfollow(lineMessage.source.userId, lineMessage.timestamp).then(function(){
        //return linebot.unlinkRichMenu(lineMessage.source.userId, process.env.RICHMENUID1);
      }), context);
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