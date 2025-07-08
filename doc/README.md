# トヨタセールスAIアシスタント

トヨタセールスAIアシスタントは、自動車販売店の営業担当者向けに設計された支援ツールです。顧客情報に基づいて最適な車種提案、質問応答、セールストークの生成を行い、効果的な商談をサポートします。

## 主な機能

- **車種提案**: 顧客情報に基づいた最適な車種・グレード・支払い方法の提案
- **質問応答**: 顧客や営業担当者からの質問に対する回答生成
- **セールストーク**: 提案内容をもとにした効果的なセールストークの生成
- **商談履歴管理**: 過去の商談内容の保存・参照・CSV出力
- **API設定管理**: 外部AIサービス（Dify）との連携設定
- **ユーザー権限管理**: 管理者・一般ユーザーによる権限ベースのアクセス制御

## プロジェクト構成

```
prototype/
├── app/                    # メインアプリケーション
│   ├── app.py             # Flaskアプリケーション本体
│   ├── requirements.txt   # Python依存パッケージ
│   ├── instance/          # データベースファイル格納
│   ├── static/           # 静的ファイル（CSS, JS, 画像）
│   └── templates/        # HTMLテンプレート
├── design/               # UI設計ファイル
├── doc/                  # ドキュメント・サンプルスクリプト
└── .git/                # Git管理ファイル
```

## 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript (Vanilla)
- **バックエンド**: Python 3.9+, Flask 3.0.0
- **データベース**: SQLite 3 (開発環境)
- **認証**: Flask-Login
- **ORM**: SQLAlchemy 2.0.27
- **外部API**: Dify AI Platform

## 構築手順

### Windows環境での構築

#### 前提条件

- Python 3.9以上
- pip（Pythonパッケージマネージャー）
- Git（ソースコード管理）

#### インストール手順

1. リポジトリのクローン
```powershell
git clone <repository-url>
cd prototype
```

2. 依存パッケージのインストール
```powershell
pip install -r app/requirements.txt
```

3. データベースの初期化
```powershell
cd app
python -c "from app import app, db; app.app_context().push(); db.create_all()"
```

4. アプリケーションの実行
```powershell
python app.py
```

5. ブラウザでアクセス

ブラウザで [http://localhost:5001](http://localhost:5001) にアクセスし、以下のアカウントでログイン：

**一般ユーザー**:
- ユーザー名: demo
- パスワード: demo

**管理者ユーザー**:
- ユーザー名: admin
- パスワード: admin

#### API設定

**管理者ユーザー**でログイン後、以下の手順でAPIを設定します：

1. 設定画面（歯車アイコン）を開く
2. APIエンドポイントURLを入力
3. 各種APIキー（提案生成用、質問応答用、セールストーク生成用）を入力
4. 「接続テスト」をクリックして接続を確認
5. 「設定を保存」をクリック

**一般ユーザー**は設定画面にアクセスできませんが、管理者が設定したAPI設定を自動的に使用してAI機能を利用できます。

### AWS環境での構築

#### 前提条件

- AWSアカウント
- EC2インスタンスの作成権限
- セキュリティグループの設定権限

#### EC2インスタンス設定

1. **EC2インスタンスの作成**
   - Amazon Linux 2023 AMI を選択
   - t2.micro 以上のインスタンスタイプを推奨
   - セキュリティグループで以下のポートを開放:
     - SSH (22)
     - HTTP (80)
     - HTTPS (443)

2. **インスタンスセットアップ**

```bash
# 必要なパッケージのインストール
sudo dnf update -y
sudo dnf install git python3-pip python3-devel -y

# リポジトリのクローン
git clone <repository-url>
cd prototype

# 依存パッケージのインストール
pip3 install -r app/requirements.txt

# アプリケーションの初期化
cd app
python3 -c "from app import app, db; app.app_context().push(); db.create_all()"
```

3. **Nginx設定**

```bash
# Nginxのインストール
sudo dnf install nginx -y

# Nginx設定ファイルの作成
sudo tee /etc/nginx/conf.d/toyota-sales.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Nginx起動と自動起動設定
sudo systemctl start nginx
sudo systemctl enable nginx
```

4. **アプリケーションサービス化**

```bash
# systemdサービスファイルの作成
sudo tee /etc/systemd/system/toyota-sales.service > /dev/null << 'EOF'
[Unit]
Description=Toyota Sales AI Assistant
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/prototype/app
ExecStart=/usr/bin/python3 app.py
Restart=always
Environment=FLASK_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# サービスの有効化と開始
sudo systemctl daemon-reload
sudo systemctl start toyota-sales
sudo systemctl enable toyota-sales
```

5. **アクセス確認**

EC2インスタンスのパブリックIPアドレスにブラウザでアクセスし、以下のアカウントでログイン：

**一般ユーザー**:
- ユーザー名: demo
- パスワード: demo

**管理者ユーザー**:
- ユーザー名: admin
- パスワード: admin

## ユーザー権限管理

### ユーザー種別

#### 管理者ユーザー (role: 'admin')
- **API設定**: 設定の参照・変更・保存が可能
- **設定画面**: 歯車アイコンが表示され、設定モーダルにアクセス可能
- **AI機能**: 自分の設定したAPI設定を使用してAI機能を利用
- **履歴管理**: 自分の商談履歴を管理

#### 一般ユーザー (role: 'user')
- **API設定**: 管理者が設定したAPI設定を自動的に参照（変更不可）
- **設定画面**: 歯車アイコンが非表示、ユーザー名クリックで制限メッセージ表示
- **AI機能**: 管理者の設定したAPI設定を使用してAI機能を利用
- **履歴管理**: 自分の商談履歴を管理

### 権限制御の仕組み

1. **データベースレベル**: Userテーブルの`role`カラムで権限を管理
2. **API レベル**: `@admin_required`デコレータでエンドポイントのアクセス制御
3. **フロントエンドレベル**: Jinja2テンプレートで`current_user.is_admin()`による表示制御
4. **設定共有**: `get_active_api_settings()`関数で権限に応じた設定取得

## データベース設計

### 主要テーブル

#### Users（ユーザー）
- id: 主キー
- username: ユーザー名（一意）
- password: パスワード
- role: ユーザー権限（'user' または 'admin'、デフォルト: 'user'）

#### ApiSettings（API設定）
- id: 主キー
- user_id: ユーザーID（外部キー）
- api_endpoint: APIエンドポイントURL
- proposal_api_key: 提案生成用APIキー
- qa_api_key: 質問応答用APIキー
- salestalk_api_key: セールストーク生成用APIキー
- last_tested: 最終接続テスト日時
- is_connected: 接続状態

#### History（商談履歴）
- id: 主キー
- user_id: ユーザーID（外部キー）
- customer_name: 顧客名
- customer_type: 顧客タイプ
- customer_details: 顧客詳細情報
- dealer_info: 販売店情報
- proposal_data: 提案データ（JSON）
- car_model: 推奨車種
- sales_talk: セールストーク
- created_at: 作成日時

## API仕様

### 内部API

#### 認証
- `POST /login` - ログイン
- `GET /logout` - ログアウト

#### API設定
- `GET /api/settings` - API設定取得（一般ユーザーは管理者設定を参照、管理者は自分の設定を取得）
- `POST /api/settings` - API設定保存（管理者のみ）
- `POST /api/test-connection` - API接続テスト（管理者のみ）

#### 提案生成
- `POST /api/generate-proposal` - 車種提案生成

#### 質問応答
- `POST /api/ask-question` - 質問応答

#### セールストーク
- `POST /api/generate-sales-talk` - セールストーク生成

#### 履歴管理
- `GET /api/history` - 履歴一覧取得
- `POST /api/save-history` - 履歴保存
- `GET /api/export-history` - 履歴CSV出力

### 外部API（Dify連携）

アプリケーションは外部のDify AIプラットフォームと連携して以下の機能を提供します：

1. **提案生成API**: 顧客情報に基づく車種・支払い方法の提案
2. **質問応答API**: 営業活動に関する質問への回答
3. **セールストークAPI**: 効果的なセールストークの生成

## トラブルシューティング

### よくある問題と解決策

1. **API接続エラー**
   - APIエンドポイントとAPIキーが正しく設定されているか確認
   - ネットワーク接続やファイアウォール設定を確認
   - API接続テスト機能を使用して診断

2. **データベースエラー**
   - SQLiteファイルの権限を確認
   - `instance/` ディレクトリが存在することを確認
   - データベース初期化コマンドを再実行

3. **静的ファイルが読み込まれない**
   - `static/` ディレクトリの構造を確認
   - ブラウザのキャッシュをクリア
   - Flask設定の `static_folder` パスを確認

4. **ログインできない**
   - デモユーザーが作成されているか確認
   - データベースの`users`テーブルを確認
   - アプリケーション起動時のログを確認

### ログの確認

```bash
# systemdサービスのログ確認（Linux）
sudo journalctl -u toyota-sales -f

# アプリケーション直接実行時のログ
python app.py
```

## 開発・カスタマイズ

### 環境設定

開発環境では以下の設定が有効です：
- デバッグモード有効
- ホットリロード機能
- 詳細エラー表示

### ファイル構成

- `app.py`: メインアプリケーションファイル
- `templates/`: HTMLテンプレート
- `static/css/`: スタイルシート
- `static/js/`: JavaScript
- `static/images/`: 画像ファイル

### テスト

サンプルスクリプトを使用してAPI機能をテストできます：

- `doc/dify_recommendreq_sample.py` - 提案生成API
- `doc/dify_qa_sample.py` - 質問応答API
- `doc/dify_conversation_sample.py` - 会話生成API

## 参考情報

- **Flask公式ドキュメント**: [https://flask.palletsprojects.com/](https://flask.palletsprojects.com/)
- **Flask-Login**: [https://flask-login.readthedocs.io/](https://flask-login.readthedocs.io/)
- **SQLAlchemy**: [https://docs.sqlalchemy.org/](https://docs.sqlalchemy.org/)
- **Dify AI Platform**: [https://docs.dify.ai/](https://docs.dify.ai/)

## ライセンス

このプロジェクトは概念実証（PoC）目的で開発されています。

## 注意事項

- 本アプリケーションは開発・テスト環境での使用を想定しています
- 本番環境での使用時は、パスワードのハッシュ化、HTTPS対応、セキュリティ強化が必要です
- API接続に必要な認証情報は各自で取得・設定してください