var request = require('request');
var qs = require('querystring');
var fs = require('fs');
var env = require('dotenv');

if(fs.existsSync('.env')){
  process.env = Object.assign(env.load().parsed, process.env);
}

var apiRequests = {
  hotpepper: "http://webservice.recruit.co.jp/hotpepper/gourmet/v1/",
  gnavi: "https://api.gnavi.co.jp/RestSearchAPI/20150630/",
  google_place: "https://maps.googleapis.com/maps/api/place/",
  yelp: "https://api.yelp.com/v3/businesses/search"
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

  this.requestGooglePlace = function(searchObj = {}) {
    if(!searchObj.latitude || !searchObj.longitude){
      return;
    }
    var request_params = {
      key: process.env.GOOGLE_APIKEY,
      location: [searchObj.latitude, searchObj.longitude].join(","),
      // 半径(メートル)
      radius: 500,
      // 絞り込む施設種別。convenience_store,department_store,shopping_mall,store  は一旦stay
      types: "bakery|cafe|restaurant|meal_delivery|meal_takeaway"
    };
    // apiRequests.google_place + "nearbysearch/json"
    // apiRequests.google_place + "radarsearch/json"
    // radarsearchの場合 {"geometry":{"location":{"lat":35.6654288,"lng":139.7313736}},"id":"adec56633b11850885e6eb192bfcac05670c16c5","place_id":"ChIJHU98fXiLGGARFVo98cPvr8U","reference":"CmRSAAAApQbyfeCmn_slXfULoEWSbD33q3Yuy7LTqVsRKAZ7KB6wz6477HQp5C9qNrfvXnC-nnIg7CGH9aJC41NQQvm7ePlDAf_02Jf3IC-4Xn-8Vphcfj7PWneKuR_bq3dEPQqTEhDSeisK-y-6cwbvJ7Ix7HaFGhRIwfoMfM08U6GdCNJjsXwpUBYQtA"}
    return new Promise((resolve, reject) => {
      request({url: apiRequests.google_place + "nearbysearch/json", qs: request_params, json: true }, function(error, res, body) {
        if (error) {
          reject(error);
          return;
        }
        resolve(res, body);
      });
    })
  };

  this.requestYelp = function(searchObj = {}) {
    if(!searchObj.latitude || !searchObj.longitude){
      return;
    }
    var request_params = {
      latitude: searchObj.latitude,
      longitude: searchObj.longitude,
      // 半径(メートル)
      radius: 500,
      limit: 50
    };
    return new Promise((resolve, reject) => {
      request({url: apiRequests.yelp, qs: request_params, headers: {"Authorization": ["Bearer", process.env.YELP_APIKEY].join(" ")}, json: true }, function(error, res, body) {
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
    return this.requestGnavi(searchObj).then(function(gnaviResponse) {
      var shops = gnaviResponse.body.rest;
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
      return this.requestHotpepper(searchObj)
    }).then(function(hotpepperResponse) {
      return new Promise((resolve, reject) => {
        var shops = hotpepperResponse.body.results.shop;
        for(var i = 0;i < shops.length;++i){
          var restaurantObj = {
            id: "hotpepper_" + shops[i].id,
            orginal_id: shops[i].id,
            latitude: shops[i].lat,
            longitude: shops[i].lng,
            address: shops[i].address,
            name: shops[i].name,
            description: shops[i].catch,
            url: shops[i].urls.pc,
            phone_number: null,
            icon_url: shops[i].photo.mobile.l || shops[i].photo.mobile.s || shops[i].photo.pc.l || shops[i].photo.pc.m || shops[i].photo.pc.s,
            coupon_url: shops[i].coupon_urls.sp || shops[i].coupon_urls.pc,
            opentime: shops[i].open,
            holiday: shops[i].close,
          };
          requestResults.push(restaurantObj);
        }
        resolve(requestResults);
      });
    }).then(function(results) {
      return new Promise((resolve, reject) => {
        resolve(underscore.sample(results, 10));
      });
    });
  }
}

module.exports = Restaurant;