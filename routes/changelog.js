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
            changelogs: [],
            issueurls: conf["issueurls"]
        };
        if (err) {
            res.render('changelog', result);
        } else {
            db.all("select log.url,log.rev,log.realauthor as realname,log.committime,log.type,log.message," +
                "log.issueno from log order by log.committime desc;",
                function (err, rows) {
                    result.err = err;
                    if (!err) {
                        var data = {};
                        for (var i in rows) {
                            var datestr = rows[i].committime.substring(0, 10);
                            var typestr = rows[i].type == null ? "未知类型" : rows[i].type;
                            if (data[rows[i].url]) {
                                if (data[rows[i].url][datestr]) {
                                    if (data[rows[i].url][datestr][typestr]) {
                                        data[rows[i].url][datestr][typestr].push(rows[i]);
                                    } else {
                                        data[rows[i].url][datestr][typestr] = [rows[i]];
                                    }
                                } else {
                                    data[rows[i].url][datestr] = {};
                                    data[rows[i].url][datestr][typestr] = [rows[i]];
                                }
                            } else {
                                data[rows[i].url] = {}
                                data[rows[i].url][datestr] = {};
                                data[rows[i].url][datestr][typestr] = [rows[i]];
                            }
                        }

                        for (var j in data) {
                            var log = {
                                url: j,
                                bydate: []
                            };
                            for (var k in data[j]) {
                                var bydate = {
                                    date: k,
                                    byclass: []
                                };
                                for (var l in data[j][k]) {
                                    var byclass = {
                                        class: l,
                                        logs: []
                                    };
                                    for (var m in data[j][k][l]) {
                                        byclass.logs.push(data[j][k][l][m]);
                                    }
                                    bydate.byclass.push(byclass);
                                }
                                log.bydate.push(bydate);
                            }
                            result.changelogs.push(log);
                        }
                    }
                    res.render('changelog', result);
                    db.close();
                });
        }
    });
});

module.exports = router;
