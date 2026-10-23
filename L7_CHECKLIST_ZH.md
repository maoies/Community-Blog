# L7 截图与 PDF 提交步骤

本指南按照用户提供的完整 L07 作业说明更新。最终提交 PDF；必须展示错误和成功状态、JSON、jQuery 搜索/更新及相关代码，并清楚标明每个部分的贡献人。

## 0. 使用更新后的代码

2026-10-18 版本已补齐 Add product，支持新增、查找、修改、保存和 JSON 导出；删除为可选，本版没有加入。

若旧版页面只有 Download JSON，没有顶部 Add product，先更新代码。

本机预检：解压 Community-Blog 文件夹，用 VS Code 打开该文件夹，终端运行 npm start，打开 http://localhost:3000/products.html。需要 Node.js 18 或以上。

老师指定的工作区：zyBooks → Module 10 – Group Project → 10.2 L7: Group Work Project。把相同版本的代码按原目录放入提供的工作区，并使用其运行/预览功能测试。不要为了导入本包而直接覆盖组员较新的修改。

产品页相关文件：
- public/products.html
- public/css/styles.css
- public/css/products.css
- public/js/product-catalog.js
- public/js/products.js
- public/data/products.json
- public/vendor/bootstrap.min.css
- public/vendor/jquery-3.7.1.min.js

页面需要通过 HTTP 预览运行，不能仅双击 HTML；jQuery 需要读取 data/products.json。

## 1. 建立截图文件夹

建立 L7_Screenshots 文件夹。最大化浏览器，暂时关闭无关面板。不要把浏览器和编辑器并排显示。

Windows：Win + Shift + S → 选择矩形区域 → 点击截图预览 → Ctrl + S → 保存 PNG。

Mac：Command + Shift + 4 → 框选区域。

网页截图保留足够上下文，尽可能包含地址栏；代码截图保留文件名和行号。字太小时分成两张，避免把全部代码缩成一张。

## 2. 截 01：产品管理页整体

打开 Products 页面，显示标题、导航、搜索框、产品卡片和右侧详情。

截图命名 01_Product_Page.png。

## 3. 截 02：验证错误

点击页面顶部 Add product，右侧显示 Add a new resource。

默认建议的 Product ID 通常是 P106；如果已经添加过，请使用当前建议的另一个唯一 ID，后面所有步骤都用同一个 ID。

暂时把 Name 和 Description 留空，价格填 -1，再点击表单底部 Add product。

截到必填/负价格的红色错误信息，命名 02_Validation_Error.png。

## 4. 截 03：新增成功

修正所有错误，填写：

| 字段 | 内容 |
| --- | --- |
| Product ID | P106，或工作区当前可用的唯一 ID |
| Product name | Weekend Reading Mini Guide |
| Description | A short digital guide with weekend reading ideas and discussion questions. |
| Category | Reading |
| Unit of measure | Download |
| Price | 3.99 |

点击表单底部 Add product。应显示该 ID added 的成功消息，产品出现在列表中。

同时截到新增产品及成功消息，命名 03_Add_Success.png。这张也证明成功状态和动态显示。

## 5. 截 04：jQuery 搜索

在 Search by ID or name 输入刚才的 Product ID，点击 Search。

截到输入的 ID、匹配的产品卡片和详情，命名 04_Search_Result.png。

可选：清空 ID，选择 Reading 分类，另截分类筛选效果。它是补充，不是老师规定的固定截图数量。

## 6. 截 05：更新成功

保持刚才的产品处于选中状态，把 Price 从 3.99 改为 4.49，点击 Save changes。

截到 updated 成功消息、表单新价格和列表新价格，命名 05_Update_Success.png。

## 7. 截 06：与页面一致的 JSON

确认没有未保存改动，点击页面顶部 Download JSON。

用 VS Code 打开刚下载的 products.json，搜索刚才的 Product ID。

截到该完整对象，包含 productId、description、category、unitOfMeasure、price；price 应为 4.49。

命名 06_Updated_JSON.png。不要只截仍为旧值的原始样例 JSON。

本版 Save changes 把 JSON 数据保存在当前浏览器，Download JSON 导出全部已保存内容，不会自动写入服务器源文件。准备最终代码时，先备份原 public/data/products.json，再用导出的最新 JSON 更新提交版本的数据文件，使源文件与展示一致。再次运行检查后截图。

## 8. 截相关代码

单独最大化编辑器，分别打开文件；不要与网页分屏。以下是截图内容，不是老师限定的固定张数：

| 文件 | 截图内容 |
| --- | --- |
| products.html | Bootstrap/CSS/jQuery 引用、页面导航；表单字段、校验信息区域及按钮，必要时分两张 |
| products.css | 列表/编辑布局及移动端 @media 规则，必要时分两张 |
| product-catalog.js | validate：必填、ID 唯一性、价格校验；load 和 $.getJSON；search；create、update、persist 和 JSON.stringify/toJSON，按函数分张 |
| products.js | 搜索表单和分类选择器的 .on 事件；产品表单提交、校验、调用 create/update、成功/错误消息、renderResults，按函数分张 |
| products.json | 第 7 步的最新 JSON 已可作为这一项的截图 |

不用截完整 Bootstrap 或 jQuery 压缩库。截自己的引用、Bootstrap 类和相关 jQuery 使用代码。

无需重交 Homepage 或 Signup 的代码截图。网站中仍须保留首页和导航。

## 9. 整理 PDF

在 Word 新建简单文档，黑色文字，标题可加粗。依次放：

1. 封面：Group 1、课程、L07 标题、所有组员姓名。
2. Contribution：按真实分工列成员和负责内容。
3. 产品页整体截图。
4. 验证错误截图。
5. 新增成功截图。
6. 搜索截图。
7. 更新成功截图。
8. 最新 JSON 截图。
9. 相关代码截图。

每一节写 Contributor: 实际负责同学姓名。多人共同负责时写所有实际负责者；不要虚构分工。

已知小组名单为 Frank Bai、Jiahao Gu、Seseena Abraham、Tyler Sylvain；提交前与小组实际名单核对。

插入 PNG，保持比例；代码图必要时一页一张，确保阅读清楚。不要用截图覆盖截图，也不要使用分屏画面。

Word → 导出或另存为 PDF。建议文件名 Group1_L07_Product_Management_Report.pdf，老师未在所提供文字中规定固定文件名。

## 10. 提交 Canvas

打开导出的 PDF，逐页检查可读性、错误/成功状态、JSON 新价格以及所有成员姓名和贡献。

进入 Canvas 的 L07 作业，上传 PDF，完成 Submit Assignment，并确认出现已提交状态。

作业允许重复提交；按老师说明，截止后的最后一次提交会被评分。具体截止时间请看 Canvas 作业栏。

## 当前验证状态

17 组 Node HTTP / jsdom 集成检查通过，使用实际完整 jQuery 3.7.1。真实浏览器布局、原生弹窗焦点及下载交互尚未实测；需要在本机或 zyBooks 预览中复核。本包未含伪造截图或最终提交 PDF。

当前 GitHub 连接只读，本地分支 frank-l7-products 尚未推送。合并时核对小组最新代码。
