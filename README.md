# The Common Room — Community Blog

按课堂要求完成的简易社区博客，只有两个网页：

- `public/index.html`：博客首页，CSS / Bootstrap 样式和导航。
- `public/signup.html`：独立注册页，必填姓名、年龄、邮箱、地址；电话选填。下方表格动态显示成员，Edit 可更新现有记录。

## 运行

在 VS Code 中打开本文件夹，在终端运行：

```text
node server.js
```

浏览器打开 http://localhost:3000 。需要 Node.js 18 或以上，无需安装 npm 依赖。也可按 F5 运行。停止服务用 Ctrl+C。

请通过这个服务访问页面。直接双击 HTML 或使用 Live Server 不能写入本项目的 JSON 文件。

## 文件说明

```text
public/index.html          博客首页
public/signup.html         注册表单和成员表格
public/css/styles.css      自定义样式
public/js/validation.js    表单验证规则（前后端共用）
public/js/signup.js        提交、动态显示和编辑
public/vendor/            本地 Bootstrap CSS 和许可证
server.js                  读取和写入 JSON 文件的小型服务
data/members.json          用户提交的数据
docs/screenshots/          首页和验证预览截图
```

表单使用 Bootstrap 网格。JavaScript 检查必填项、邮箱格式、整数年龄和选填电话；提交后显示成功提示并更新表格。年龄范围为 13–120。点击 Edit，修改表单并按 Save changes，即可更新同一条 JSON 记录。

## 截图步骤

1. 截取首页。
2. 到 Sign Up 页面，空表单提交，截取错误提示。
3. 使用示例资料注册，在 VS Code 打开 `data/members.json` 截取保存的记录。

使用独立截图，不要分屏。Bootstrap 为 MIT 许可证，见 `public/vendor/BOOTSTRAP-LICENSE.txt`。
