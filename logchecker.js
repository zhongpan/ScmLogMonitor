/**
 * Created by zhongpan on 2016/1/12.
 */

module.exports = function () {
    var fs = require('fs');
    var conf = JSON.parse(fs.readFileSync('./conf.json'));

    var nodemailer = require('nodemailer');
    //配置邮件
    var transporter = nodemailer.createTransport({
        host: conf["mail"]["host"],
        port: conf["mail"]["port"],
        secure: conf["mail"]["secure"],
        tls: {
            rejectUnauthorized: conf["mail"]["secure"]
        },
        auth: {
            user: conf["mail"]["user"],
            pass: conf["mail"]["password"]
        },
        debug: true,
        pool: true,
        maxConnections: conf["mail"]["maxconnections"],
        maxMessages: conf["mail"]["maxmessages"],
        rateLimit: conf["mail"]["maxmessages"]
    });
    //发送邮件
    var sendmail = function (to, html) {
        if (to in conf["mail"]["sendtomapping"]) {
            to = conf["mail"]["sendtomapping"][to];
        }
        addr = conf["mail"]["user"].split("@")[1];
        var option = {
            from: conf["mail"]["user"],
            to: `${to}@${addr}`,
            bcc: conf["mail"]["user"]
        };
        option.subject = `SVN LOG ERROR`;
        option.html = html;
        option.date = new Date(new Date().toLocaleString());
        transporter.sendMail(option, function (error, response) {
            if (error) {
                console.log("Send Mail Fail: " + error);
            } else {
                console.log("Send Mail Success: " + to);
            }
        });
    };
    var reStr = "^(\\[qztj\\])?\\[(bug fix|build fix|review fix|new feature|optimize|close feature|merge|maintance|migrate)\\]" +
        "([\\s\\S]+?)(?=(?:\\[from=|\\[compatible=|\\[author=|issue |\\s*$))" +
        "(?:\\s*\\[from=(http://.+),rev=((?:(?:\\d+|\\d+-\\d+)\\,)*(?:\\d+|\\d+-\\d+))\\])?" +
        "(?:\\s*\\[compatible=(true|false)\\])?" +
        "(?:\\s*\\[author=(\\w+)\\])?" +
        "(?:\\s*issue (\\d+))?" +
        "(?:[\\s\\S]*$)";
    var re = new RegExp(reStr, "i");
    var sqlite3 = require('sqlite3');
    var db = new sqlite3.Database(conf["db"]["name"], function (err) {
        if (err) {
            console.log("Open Sqlite DB Error: " + err);
        }
    });
    var spawn = require('child_process').spawn;

    function getDetail(logData, publicUser) {
        if (!logData.message) {
            logData.message = "";
        }
        var result = logData.message.match(re);
        if (result) {
            logData.iserror = 0;
            if (publicUser != "" && logData.author === publicUser) {
                if (result[7] == undefined) {
                    logData.iserror = 1;
                    return;
                } else {
                    logData.realauthor = result[7];
                }
            }
            logData.type = result[2];
            if (logData.type === "merge") {
                if (result[4] == undefined || result[5] == undefined) {
                    logData.iserror = 1;
                    logData.type = null;
                    return;
                } else {
                    logData.mergefrom = result[4];
                    logData.mergerev = result[5];
                }
            }
            if (result[1]) {
                logData.isqztj = 1;
            }
            logData.message = result[3];
            if (result[6]) {
                logData.iscompatible = result[6] == "true" ? 1 : 0;
            }
            if (result[8]) {
                logData.issueno = result[8];
            }
        } else {
            logData.iserror = 1;
        }
    }

    function checkLog(url, cmd, cmd_options, publicUser, olds) {
        var log = spawn(cmd, cmd_options);
        var saxStream = require('sax').createStream(true, {
            lowercasetags: true,
            trim: true
        });
        var logEntry = null;
        var currentTag = null;
        var userErrorLog = {};
        var isupdate = false;
        saxStream.on("closetag", function (tagName) {
            if (tagName === 'logentry') {
                var logData = null;
                if (olds != undefined && olds != null && olds.length > 0) {
                    isupdate = true;
                    logData = olds.find(function (item) {
                        return item.url == url && item.rev == logEntry.attributes.revision
                    });
                    logData.message = logEntry.children[3].children[0];
                    logData.committime = logEntry.children[1].children[0];
                    logData.paths = logEntry.children[2].children.map(item => item.children[0]).join(",");
                    logData.checktime = new Date().toString();
                } else {
                    isupdate = false;
                    logData = new function () {
                        this.message = logEntry.children[3].children[0];
                        this.rev = logEntry.attributes.revision;
                        this.author = logEntry.children[0].children[0];
                        this.realauthor = this.author;
                        this.committime = logEntry.children[1].children[0];
                        this.paths = logEntry.children[2].children.map(item => item.children[0]).join(",");
                        this.type = null;
                        this.isqztj = 0;
                        this.iscompatible = 1;
                        this.mergefrom = null;
                        this.mergerev = null;
                        this.issueno = null;
                        this.checktime = new Date().toString();
                        this.iserror = 0;
                        this.errorcount = 0;
                    };
                }
                getDetail(logData, publicUser);
                if (logData.iserror) {
                    logData.errorcount++;
                    var user = logData.author;
                    if (logData.realauthor) {
                        user = logData.realauthor;
                    }
                    if (userErrorLog[user]) {
                        userErrorLog[user].push(logData);
                    } else {
                        userErrorLog[user] = [];
                        userErrorLog[user].push(logData);
                    }
                }

                if (isupdate) {
                    db.run("update log set realauthor=?,committime=?,type=?,isqztj=?,iscompatible=?,mergefrom=?,mergerev=?\
                                ,message=?,issueno=?,iserror=?,errorcount=? where url=? and rev=?",
                        [logData.realauthor, logData.committime, logData.type, logData.isqztj, logData.iscompatible,
                        logData.mergefrom, logData.mergerev, logData.message,
                        logData.issueno, logData.iserror, logData.errorcount, url, logData.rev], function (err) {
                            if (err) {
                                console.log(`Update Sqlite DB Error: ${err}(${logData.url},${logData.rev})`);
                            }
                        });
                } else {
                    db.run("insert into log(url, rev, author, realauthor,committime,paths,type,\
                            isqztj,iscompatible,mergefrom,mergerev,message,issueno,checktime,iserror,errorcount) \
                            values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [url, logData.rev, logData.author, logData.realauthor,
                        logData.committime, logData.paths, logData.type,
                        logData.isqztj, logData.iscompatible, logData.mergefrom, logData.mergerev, logData.message, logData.issueno, logData.checktime,
                        logData.iserror, logData.errorcount], function (err) {
                            if (err) {
                                console.log(`Insert Sqlite DB Error: ${err}(${logData.url},${logData.rev})`);
                            }
                        });
                }
                currentTag = logEntry = null
                return
            }
            if (currentTag && currentTag.parent) {
                var p = currentTag.parent
                delete currentTag.parent
                currentTag = p
            }
        });

        saxStream.on("opentag", function (tag) {
            if (tag.name !== 'logentry' && !logEntry) return
            if (tag.name === 'logentry') {
                logEntry = tag
            }
            tag.parent = currentTag
            tag.children = []
            tag.parent && tag.parent.children.push(tag)
            currentTag = tag
        });

        saxStream.on("text", function (text) {
            if (currentTag) currentTag.children.push(text)
        });

        saxStream.on('error', function (error) {
            console.log("SVN Log Parse Error: " + error);
        });

        var getMailContent = function (user, logs) {

            var getErrorLogList = function () {
                var result = "";
                for (var i in logs) {
                    result += `<li><b>rev${logs[i].rev}</b>: ${logs[i].message}(${logs[i].committime})</li>`;
                }
                return result;
            };

            var mailContent = `
${user}，你好:<br/>

<p>${isupdate ? "你的如下提交仍然违反版本提交日志规范，请尽快修正！" : "你最近的提交违反了版本提交日志规范，请尽快修正！"}</p>

<h3>违反规则日志列表如下：</h3>
<h4>地址：${url}</h4>
<ol>
${getErrorLogList()}
</ol><br/><br/><a href="${conf["homepage"]}">-点击访问规范定义-</a>`;
            return mailContent;
        };

        saxStream.on("end", function (error) {
            //发邮件
            if (!error) {
                for (var user in userErrorLog) {
                    sendmail(user, getMailContent(user, userErrorLog[user]));
                }
            }
        });
        log.stdout.pipe(saxStream);
        log.stderr.on("data", function (data) {
            if (data) {
                var options = log.spawnargs.join(" ");
                console.log(`CMD: ${options}, Erormsg: ${data.toString()}`);
            }
        });
        log.on("exit", function (code) {
            var options = log.spawnargs.join(" ");
            console.log(`CMD: ${options}, Retcode: ${code}`);
        });
    }

    // 对Date的扩展，将 Date 转化为指定格式的String
    // 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
    // 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
    // 例子：
    // (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
    // (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
    Date.prototype.Format = function (fmt) { //author: meizz
        var o = {
            "M+": this.getMonth() + 1, //月份
            "d+": this.getDate(), //日
            "h+": this.getHours(), //小时
            "m+": this.getMinutes(), //分
            "s+": this.getSeconds(), //秒
            "q+": Math.floor((this.getMonth() + 3) / 3), //季度
            "S": this.getMilliseconds() //毫秒
        };
        if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return fmt;
    }

    var schedule = require('node-schedule');
    var rule = conf["cornscheduler"];
    var j = schedule.scheduleJob(rule, function () {
        console.log("Job Start: " + new Date().Format("yyyy-MM-dd hh:mm:ss"));
        conf["targets"].forEach(function (target) {
            var url = target["master"];
            var cmd = target["cmd"];
            //对上次有错误的日志再检查一遍
            db.all("select * from log where url=? and iserror=1 order by rev", [url], function (err, rows) {
                if (rows.length == 0) {
                    return;
                }
                var cmd_options = target["options"];
                cmd_options = cmd_options.concat(["--username", target["user"], "--password", target["password"]]);
                if (rows.length > 0) {
                    for (var i in rows) {
                        cmd_options.push("-r");
                        cmd_options.push(`${rows[i].rev}`);
                    }
                }
                cmd_options.push(url);
                checkLog(url, cmd, cmd_options, target["publicuser"], rows);
            });
            //检查新的日志
            db.get("select max(rev) as maxrev from log where url=?", [url], function (err, row) {
                var cmd_options = target["options"];
                cmd_options = cmd_options.concat(["--username", target["user"], "--password", target["password"]]);
                if (row.maxrev == null) {
                    cmd_options.push("-r");
                    cmd_options.push(`${target["from"]}:${target["to"]}`);
                } else {
                    cmd_options.push("-r");
                    cmd_options.push(`${row.maxrev + 1}:${target["to"]}`);
                }
                cmd_options.push(url);
                checkLog(url, cmd, cmd_options, target["publicuser"]);
            });

        });
    });


}
