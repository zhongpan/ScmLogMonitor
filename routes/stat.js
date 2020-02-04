var express = require('express');
var router = express.Router();
var sqlite3 = require('sqlite3');
var fs = require('fs');
/* GET home page. */
router.get('/', function (req, res, next) {
    var conf = JSON.parse(fs.readFileSync('./conf.json'));
    var db = new sqlite3.Database(conf["db"]["name"], function (err) {
        var result = {
            err: err,
            stats_byurl: [],
            stats_bytype: []
        };
        if (err) {
            res.render('stat', result);
        } else {
            db.all("select count(*) as cnt,log.url,log.realauthor,log.iserror from log " +
                "group by url,realauthor,iserror order by log.url", function (err, rows) {
                    result.err = err;
                    var data = {};
                    if (!err) {
                        for (i in rows) {
                            var url = rows[i].url;
                            var author = rows[i].realauthor;
                            var iserror = rows[i].iserror;
                            var cnt = rows[i].cnt;
                            if (data[url]) {
                                if (data[url][author]) {
                                    if (iserror) {
                                        data[url][author].ecnt = cnt;
                                    } else {
                                        data[url][author].scnt = cnt;
                                    }
                                } else {
                                    data[url][author] = { ecnt: iserror ? cnt : 0, scnt: iserror ? 0 : cnt };
                                }
                            } else {
                                data[url] = {};
                                data[url][author] = { ecnt: iserror ? cnt : 0, scnt: iserror ? 0 : cnt };
                            }
                        }
                        for (j in data) {
                            var byurl = { url: j, data: [] };
                            for (k in data[j]) {
                                var byauthor = { author: k, ecnt: data[j][k].ecnt, scnt: data[j][k].scnt };
                                byurl.data.push(byauthor);
                            }
                            result.stats_byurl.push(byurl);
                        }
                    }

                    db.all("select count(*) as cnt,url,type from log group by url,type order by url", function (err, rows) {
                        result.err = err;
                        if (!err) {
                            var data = {};
                            for (i in rows) {
                                var url = rows[i].url;
                                var type = rows[i].type == null ? "未知类型" : rows[i].type;
                                var cnt = rows[i].cnt;
                                if (data[url]) {
                                    data[url][type] = cnt;
                                } else {
                                    data[url] = {};
                                    data[url][type] = cnt;
                                }
                            }
                            for (j in data) {
                                var bytype = { url: j, data: [] };
                                for (k in data[j]) {
                                    bytype.data.push({ type: k, cnt: data[j][k] });
                                }
                                result.stats_bytype.push(bytype);
                            }
                        }

                        res.render('stat', result);
                        db.close();
                    });

                });
        }
    });
});

module.exports = router;
