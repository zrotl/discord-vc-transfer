# stream-bot
## 使い方
* どっかしらのサイトを参考にして、下記のものを入れる。
    - discord.js (14.12.x)
    - node.js (22.x.x)
    - npm (x.x.x)

* Botを２つ作成。

* `config copy.json`の名前を`config.json`に変更して中身を自分の環境に合わせて編集する。

* `index.js`の階層でコマンドプロンプト等を開き、`npm i`を実行。

* `index.js`の階層でコマンドプロンプト等を開き、`node deploy-commands.js`を実行。

* `index.js`の階層でコマンドプロンプト等を開き、`node index.js`を実行。

* VCの音を別のVCに中継したい時
    - `/stream`を実行。
    - `/streamnew`も同様。内部動作が異なる。
    - 終了時は`/bye`を実行。
