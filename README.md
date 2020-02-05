# ScmLogMonitor
ScmLogMonitor是采用nodejs实现的一个B/S系统，专注于对版本管理器的提交日志进行规范化，实现以下特性：
* 规范版本管理器提交日志格式，对不符合格式自动发送邮件提醒；
* 前端页面图形化展示不符合格式的统计信；
* 前端页面生成提交日志信息，可作为发布版本的releaselog

# 使用方法
## 修改配置文件
conf.json
```json
{
  "targets": [
    {
      "master": "https://localhost/svn/test/trunk",
      "branchfrom": "",
      "user": "zhongpan",
      "password": "xxxxxx",
      "cmd": "svn",
      "options": [
        "log",
        "--xml",
        "-v",
        "--stop-on-copy"
      ],
      "to": "HEAD",
      "from": "1",
      "publicuser": "pqaunm2000"
    }
  ],
  "mail": {
    "host": "smtp.fiberhome.com",
    "user": "unm2000@fiberhome.com",
    "password": "xxxxxx",
    "port": 465,
    "secure": true,
    "maxconnections": 5,
    "maxmessages": 10,
    "sendtomapping": {
      "yzhang": "yongzhang"
    }
  },
  "homepage": "http://127.0.0.1:3000",
  "issueurls": {
    "bug": "http://10.78.13.168/tdmantis/view.php?id=",
    "review": "http://10.78.13.188/go?page=ReviewDisplay&reviewid=",
    "feature": "http://10.78.13.168/InformationPlatform/guidepostCommon/viewGuidepostObject?viewObjectType=FUNCTION&viewObjectId="
  },
  "db": {
    "name": "data.db3"
  },
  "cornscheduler": "* * 12,24 * * ?"
}
```

## 启动服务
* npm install
* npm start

# 截图
* 首页
![index](https://github.com/zhongpan/ScmLogMonitor/blob/master/screenshots/index.png)
* 提交日志
![changelog](https://github.com/zhongpan/ScmLogMonitor/blob/master/screenshots/changelog.png)
* 统计
![stat](https://github.com/zhongpan/ScmLogMonitor/blob/master/screenshots/stat.png)
