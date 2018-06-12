var request = require('request');
var qs = require('querystring');
var env = require('dotenv');

process.env = Object.assign(env.load().parsed, process.env);

var apiRequests = {
  hotpepper: "http://webservice.recruit.co.jp/hotpepper/gourmet/v1/",
  gnavi: "https://api.gnavi.co.jp/RestSearchAPI/20150630/",
  google_place: "https://maps.googleapis.com/maps/api/place/nearbysearch/output?parameters",
  yelp: "https://api.yelp.com/v3/"
};

var Restaurant = function(){
  this.requestHotpepper = function(searchObj = {}) {
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
      request({url: apiRequests.hotpepper, qs: request_params, json: true }, function(error, res) {
        if (error) {
          reject(error);
          return;
        }
        resolve(res);
      });
    });
  };

  this.requestGnavi = function(searchObj = {}) {
    var request_params = {
//      range: 3,
      format: "json",
      keyid: process.env.GNAVI_APIKEY,
      coordinates_mode: 2,
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
    if(searchObj.latitude && searchObj.longitude){
      // 世界測地系
      request_params.input_coordinates_mode = 2;
      request_params.range = searchObj.range;
      request_params.latitude = searchObj.latitude;
      request_params.longitude = searchObj.longitude;
    }
    if(searchObj.keyword){
      request_params.freeword = searchObj.keyword;
    }
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

  this.lotRestaurant = function(searchObj = {}) {
    var requestResults = [];
    return requestHotpepper(searchObj).then(function(hotpepperResults) {
      var shops = hotpepperResults.results.shop;
      for(var i = 0;i < shops.length;++i){
        requestResults.push(shops[i]);
      }
      return requestGnavi(searchObj);
    }).then(function(gnaviResults) {
      return new Promise((resolve, reject) => {
        var shops = gnaviResults.rest;
        for(var i = 0;i < shops.length;++i){
          var restaurantObj = {
            id: "gnavi_" + shops[i].id,
            orginal_id: shops[i].id,
            latitude: shops[i].latitude,
            longitude: shops[i].longitude,
            address: shops[i].address,
            name: shops[i].name,
            description: shops[i].pr.pr_long || shops[i].pr.pr_short,
            url: shops[i].url_mobile || shops[i].url,
            phone_number: shops[i].tel || shops[i].tel_sub,
            icon_url: shops[i].image_url.shop_image1 || shops[i].image_url.shop_image2,
            coupon_url: shops[i].coupon_url.mobile || shops[i].coupon_url.pc,
            opentime: shops[i].opentime,
            holiday: shops[i].holiday,
          };
          requestResults.push(restaurantObj);
        }
        resolve(underscore.sample(requestResults, 10));
      });
    });
  }
}

module.exports = Restaurant;