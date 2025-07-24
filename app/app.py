from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_file
from flask_login import LoginManager, login_user, logout_user, login_required, current_user, UserMixin
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
import json
import requests
import sqlite3
import secrets
import csv
from io import StringIO
from functools import wraps
import pytz

# アプリケーションの設定
app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')

# セッション設定
app.secret_key = secrets.token_hex(16)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///toyota_sales.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# データベース初期化
db = SQLAlchemy(app)

# ログイン管理の設定
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# モデル定義
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), default='user')
    
    def is_admin(self):
        return self.role == 'admin'
    
class History(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    customer_name = db.Column(db.String(100), nullable=False)
    customer_type = db.Column(db.String(100), nullable=False)
    customer_details = db.Column(db.Text)
    dealer_info = db.Column(db.Text)
    proposal_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    car_model = db.Column(db.String(100))
    sales_talk = db.Column(db.Text)
    
    # ユーザー情報への関係
    user = db.relationship('User', backref='histories')

class ApiSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    api_endpoint = db.Column(db.String(255), nullable=False)
    proposal_api_key = db.Column(db.String(255))
    qa_api_key = db.Column(db.String(255))
    salestalk_api_key = db.Column(db.String(255))
    text_format_api_key = db.Column(db.String(255))
    customer_role_url = db.Column(db.String(500))
    sales_role_url = db.Column(db.String(500))
    last_tested = db.Column(db.DateTime)
    is_connected = db.Column(db.Boolean, default=False)

# 権限チェック用デコレータ
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin():
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# 日本時間変換用関数
def to_jst(utc_dt):
    """UTC時間を日本時間に変換する"""
    if utc_dt.tzinfo is None:
        utc_dt = pytz.UTC.localize(utc_dt)
    jst = pytz.timezone('Asia/Tokyo')
    return utc_dt.astimezone(jst)

# 期間フィルター計算用関数
def get_date_filter(period):
    """期間フィルターに基づいて開始日時を計算する（UTC）"""
    jst = pytz.timezone('Asia/Tokyo')
    now_jst = datetime.now(jst)
    
    if period == 'today':
        # 今日の0時0分0秒から
        start_of_day = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
        return start_of_day.astimezone(pytz.UTC)
    elif period == 'week':
        # 7日前から
        return (now_jst - timedelta(days=7)).astimezone(pytz.UTC)
    elif period == 'month':
        # 30日前から
        return (now_jst - timedelta(days=30)).astimezone(pytz.UTC)
    elif period == 'quarter':
        # 90日前から
        return (now_jst - timedelta(days=90)).astimezone(pytz.UTC)
    
    return None

# API設定取得用共通関数
def get_active_api_settings():
    """
    現在有効なAPI設定を取得する
    一般ユーザーは管理者の最新設定を参照
    管理者は自分の設定を参照
    """
    if current_user.is_admin():
        # 管理者は自分の設定を使用
        settings = ApiSettings.query.filter_by(user_id=current_user.id).first()
    else:
        # 一般ユーザーは管理者の最新設定を使用
        admin_user = User.query.filter_by(role='admin').first()
        if admin_user:
            settings = ApiSettings.query.filter_by(user_id=admin_user.id).first()
        else:
            settings = None
    
    return settings

# ユーザーローダー
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# ルート：トップページ
@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('index.html')
    return redirect(url_for('login'))

# ルート：ログイン
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.password == password:  # 実際のアプリではハッシュ化すべき
            login_user(user)
            return redirect(url_for('index'))
        
        return render_template('login.html', error="ユーザー名またはパスワードが間違っています")
    
    return render_template('login.html')

# ルート：ログアウト
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# ルート：API設定の取得
@app.route('/api/settings', methods=['GET'])
@login_required
def get_api_settings():
    # 管理者のみが設定を変更できるが、一般ユーザーも設定を参照できる
    if current_user.is_admin():
        settings = get_active_api_settings()
    else:
        # 一般ユーザーは管理者の設定を参照
        settings = get_active_api_settings()
    
    if not settings:
        # デフォルト設定を返す
        return jsonify({
            'api_endpoint': 'http://54.92.0.96/v1',
            'proposal_api_key': '',
            'qa_api_key': '',
            'salestalk_api_key': '',
            'text_format_api_key': '',
            'customer_role_url': '',
            'sales_role_url': '',
            'is_connected': False,
            'read_only': not current_user.is_admin()
        })
    
    return jsonify({
        'api_endpoint': settings.api_endpoint,
        'proposal_api_key': settings.proposal_api_key,
        'qa_api_key': settings.qa_api_key,
        'salestalk_api_key': settings.salestalk_api_key,
        'text_format_api_key': settings.text_format_api_key,
        'customer_role_url': settings.customer_role_url or '',
        'sales_role_url': settings.sales_role_url or '',
        'is_connected': settings.is_connected,
        'read_only': not current_user.is_admin()
    })

# ルート：API設定の保存
@app.route('/api/settings', methods=['POST'])
@login_required
@admin_required
def save_api_settings():
    data = request.get_json()
    
    # 管理者は自分の設定を保存
    settings = ApiSettings.query.filter_by(user_id=current_user.id).first()
    
    if not settings:
        settings = ApiSettings(user_id=current_user.id)
    
    settings.api_endpoint = data.get('api_endpoint')
    settings.proposal_api_key = data.get('proposal_api_key')
    settings.qa_api_key = data.get('qa_api_key')
    settings.salestalk_api_key = data.get('salestalk_api_key')
    settings.text_format_api_key = data.get('text_format_api_key')
    settings.customer_role_url = data.get('customer_role_url')
    settings.sales_role_url = data.get('sales_role_url')
    
    db.session.add(settings)
    db.session.commit()
    
    return jsonify({'status': 'success'})

# デバッグ用：ユーザー状態確認エンドポイント
@app.route('/api/debug/user-status', methods=['GET'])
def debug_user_status():
    """
    現在のユーザーのログイン状態と権限を確認するためのデバッグエンドポイント
    """
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user_id': current_user.id,
            'username': current_user.username,
            'role': current_user.role,
            'is_admin': current_user.is_admin()
        })
    else:
        return jsonify({
            'authenticated': False,
            'message': 'ユーザーがログインしていません'
        })

# ルート：API接続テスト
@app.route('/api/test-connection', methods=['POST'])
@login_required
@admin_required
def test_api_connection():
    settings = get_active_api_settings()
    
    if not settings:
        return jsonify({'status': 'error', 'message': 'API設定が見つかりません'})
    
    base_url = settings.api_endpoint
    test_results = {}
    overall_success = True
    
    # 各APIキーをテスト
    api_keys = {
        'proposal': settings.proposal_api_key,
        'qa': settings.qa_api_key,
        'salestalk': settings.salestalk_api_key,
        'text_format': settings.text_format_api_key
    }
    
    for api_name, api_key in api_keys.items():
        if api_key:  # APIキーが設定されている場合のみテスト
            try:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                
                response = requests.get(f"{base_url}/info", headers=headers, timeout=10)
                
                if response.status_code == 200:
                    test_results[api_name] = {'status': 'success', 'message': '接続成功'}
                else:
                    test_results[api_name] = {'status': 'error', 'message': f'HTTP {response.status_code}'}
                    overall_success = False
                    
            except Exception as e:
                test_results[api_name] = {'status': 'error', 'message': f'接続例外: {str(e)}'}
                overall_success = False
        else:
            test_results[api_name] = {'status': 'skipped', 'message': 'APIキー未設定'}
    
    # 全体の接続状態を更新
    settings.is_connected = overall_success
    settings.last_tested = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'status': 'success' if overall_success else 'partial',
        'overall_connected': overall_success,
        'test_results': test_results,
        'message': '接続テスト完了' if overall_success else '一部のAPIキーで接続に失敗しました'
    })

# ルート：提案内容生成
@app.route('/api/generate-proposal', methods=['POST'])
@login_required
def generate_proposal():
    data = request.get_json()
    
    settings = get_active_api_settings()
    
    if not settings or not settings.is_connected:
        return jsonify({'status': 'error', 'message': 'API接続が設定されていないか、接続テストに失敗しています'})
    
    # Dify APIに送信するデータ
    customer_data = {
        'customer_name': data.get('customer_name', ''),
        'customer_details': data.get('customer_details', ''),
        'customer_type': data.get('customer_type', ''),
        'dealer_info': data.get('dealer_info', '')
    }
    
    # データサイズを確認してAPIの制限内に収まるようにする
    json_data = json.dumps(customer_data)
    if len(json_data) > 45000:  # 50000文字の制限に余裕を持たせる
        # 長いフィールドを切り詰める
        customer_data['customer_details'] = customer_data['customer_details'][:5000]
        customer_data['dealer_info'] = customer_data['dealer_info'][:2000]
    
    dify_data = {
        'inputs': {
            'input': json.dumps(customer_data)
        },
        'response_mode': 'streaming',
        'user': f"user-{current_user.id}"
    }
    
    base_url = settings.api_endpoint
    headers = {
        "Authorization": f"Bearer {settings.proposal_api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{base_url}/workflows/run", headers=headers, json=dify_data, stream=True)
        
        if response.status_code != 200:
            return jsonify({'status': 'error', 'message': f'API呼び出しエラー: {response.status_code}'})
        
        # ストリームからの最終レスポンスを取得
        final_output = {}
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith("data: "):
                    json_str = line_text[6:]
                    try:
                        event_data = json.loads(json_str)
                        event_type = event_data.get("event")
                        
                        if event_type == "workflow_finished":
                            final_output = event_data.get("data", {}).get("outputs", {})
                            break
                    except json.JSONDecodeError:
                        continue
        
        if not final_output:
            return jsonify({'status': 'error', 'message': 'API処理中にエラーが発生しました'})
        
        text_output = final_output.get("text", "{}")
        
        try:
            # テキスト出力がJSON文字列の場合、パースする
            content = json.loads(text_output) if isinstance(text_output, str) else text_output
            
            # contentがdictで、textキーがある場合は、そのテキストを再度パースする
            if isinstance(content, dict) and "text" in content:
                content = json.loads(content["text"]) if isinstance(content["text"], str) else content["text"]
            
            return jsonify({'status': 'success', 'proposal': content})
            
        except json.JSONDecodeError:
            # JSONでない場合は、テキストをそのまま返す
            return jsonify({'status': 'error', 'message': 'レスポンスの形式が正しくありません', 'raw_response': text_output})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'API呼び出し例外: {str(e)}'})

# ルート：テキスト整形
@app.route('/api/format-text', methods=['POST'])
@login_required
def format_customer_text():
    data = request.get_json()
    
    settings = get_active_api_settings()
    
    if not settings or not settings.is_connected:
        return jsonify({'status': 'error', 'message': 'API接続が設定されていないか、接続テストに失敗しています'})
    
    if not settings.text_format_api_key:
        return jsonify({'status': 'error', 'message': 'テキスト整形APIキーが設定されていません'})
    
    raw_text = data.get('raw_text', '').strip()
    if not raw_text:
        return jsonify({'status': 'error', 'message': '整形するテキストが入力されていません'})
    
    # テキストサイズを確認してAPIの制限内に収まるようにする
    if len(raw_text) > 45000:  # 50000文字の制限に余裕を持たせる
        raw_text = raw_text[:45000]
    
    # Dify APIに送信するデータ
    format_data = {
        'raw_text': raw_text
    }
    
    dify_data = {
        'inputs': {
            'input': json.dumps(format_data)
        },
        'response_mode': 'streaming',
        'user': f"text-format-user-{current_user.id}"
    }
    
    base_url = settings.api_endpoint
    headers = {
        "Authorization": f"Bearer {settings.text_format_api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{base_url}/workflows/run", headers=headers, json=dify_data, stream=True)
        
        if response.status_code != 200:
            return jsonify({'status': 'error', 'message': f'API呼び出しエラー: {response.status_code}'})
        
        # ストリームからの最終レスポンスを取得
        final_output = {}
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith("data: "):
                    json_str = line_text[6:]
                    try:
                        event_data = json.loads(json_str)
                        event_type = event_data.get("event")
                        
                        if event_type == "workflow_finished":
                            final_output = event_data.get("data", {}).get("outputs", {})
                            break
                    except json.JSONDecodeError:
                        continue
        
        if not final_output:
            return jsonify({'status': 'error', 'message': 'API処理中にエラーが発生しました'})
        
        text_output = final_output.get("text", "")
        
        try:
            # テキスト出力がJSON文字列の場合、パースする
            if isinstance(text_output, str) and text_output.startswith('{'):
                content = json.loads(text_output)
                # contentがdictで、textキーがある場合はその中身を取得
                if isinstance(content, dict) and "text" in content:
                    formatted_text = content["text"]
                else:
                    formatted_text = text_output
            else:
                # JSONでない場合は、テキストをそのまま返す
                formatted_text = text_output
            
            return jsonify({'status': 'success', 'formatted_text': formatted_text})
            
        except json.JSONDecodeError:
            # JSONパースに失敗した場合は、テキストをそのまま返す
            return jsonify({'status': 'success', 'formatted_text': text_output})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'API呼び出し例外: {str(e)}'})

# ルート：セールストーク生成
@app.route('/api/generate-salestalk', methods=['POST'])
@login_required
def generate_salestalk():
    data = request.get_json()
    
    settings = get_active_api_settings()
    
    if not settings or not settings.is_connected:
        return jsonify({'status': 'error', 'message': 'API接続が設定されていないか、接続テストに失敗しています'})
    
    # Dify APIに送信するデータ
    conversation_data = {
        'customer_name': data.get('customer_name', ''),
        'customer_details': data.get('customer_details', ''),
        'customer_type': data.get('customer_type', ''),
        'proposal': data.get('proposal', {})
    }
    
    # データサイズを確認してAPIの制限内に収まるようにする
    json_data = json.dumps(conversation_data)
    if len(json_data) > 45000:  # 50000文字の制限に余裕を持たせる
        # customer_detailsとreasonを短く切り詰める
        conversation_data['customer_details'] = conversation_data['customer_details'][:2000]
        if 'proposal' in conversation_data and isinstance(conversation_data['proposal'], dict):
            for section in ['car', 'payment', 'timing', 'trade_in']:
                if section in conversation_data['proposal'] and 'reason' in conversation_data['proposal'][section]:
                    conversation_data['proposal'][section]['reason'] = conversation_data['proposal'][section]['reason'][:1000]
    
    dify_data = {
        'inputs': {
            'input': json.dumps(conversation_data)
        },
        'response_mode': 'streaming',
        'user': f"conversation-user-{current_user.id}"
    }
    
    base_url = settings.api_endpoint
    headers = {
        "Authorization": f"Bearer {settings.salestalk_api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{base_url}/workflows/run", headers=headers, json=dify_data, stream=True)
        
        if response.status_code != 200:
            return jsonify({'status': 'error', 'message': f'API呼び出しエラー: {response.status_code}'})
        
        # ストリームからの最終レスポンスを取得
        final_output = {}
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith("data: "):
                    json_str = line_text[6:]
                    try:
                        event_data = json.loads(json_str)
                        event_type = event_data.get("event")
                        
                        if event_type == "workflow_finished":
                            final_output = event_data.get("data", {}).get("outputs", {})
                            break
                    except json.JSONDecodeError:
                        continue
        
        if not final_output:
            return jsonify({'status': 'error', 'message': 'API処理中にエラーが発生しました'})
        
        text_output = final_output.get("text", "{}")
        
        try:
            # テキスト出力がJSON文字列の場合、パースする
            content = json.loads(text_output) if isinstance(text_output, str) else text_output
            
            # contentがdictで、textキーがある場合は、そのテキストを再度パースする
            if isinstance(content, dict) and "text" in content:
                content = json.loads(content["text"]) if isinstance(content["text"], str) else content["text"]
            
            return jsonify({'status': 'success', 'salestalk': content})
            
        except json.JSONDecodeError:
            # JSONでない場合は、テキストをそのまま返す
            return jsonify({'status': 'error', 'message': 'レスポンスの形式が正しくありません', 'raw_response': text_output})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'API呼び出し例外: {str(e)}'})

# ルート：質問応答
@app.route('/api/ask-question', methods=['POST'])
@login_required
def ask_question():
    data = request.get_json()
    
    settings = get_active_api_settings()
    
    if not settings or not settings.is_connected:
        return jsonify({'status': 'error', 'message': 'API接続が設定されていないか、接続テストに失敗しています'})
    
    # Dify APIに送信するデータ
    qa_data = {
        'customer_name': data.get('customer_name', ''),
        'customer_details': data.get('customer_details', ''),
        'customer_type': data.get('customer_type', ''),
        'proposal': json.dumps(data.get('proposal', {})),  # オブジェクトを文字列化
        'sales_question': data.get('question', '')  # questionをsales_questionとして送信
    }
    
    # データサイズを確認してAPIの制限内に収まるようにする
    json_data = json.dumps(qa_data)
    if len(json_data) > 45000:  # 50000文字の制限に余裕を持たせる
        # customer_detailsと提案説明文を短く切り詰める
        qa_data['customer_details'] = qa_data['customer_details'][:2000]
        proposal_obj = data.get('proposal', {})
        if isinstance(proposal_obj, dict):
            for section in ['car', 'payment', 'timing', 'trade_in']:
                if section in proposal_obj and 'reason' in proposal_obj[section]:
                    proposal_obj[section]['reason'] = proposal_obj[section]['reason'][:1000]
            qa_data['proposal'] = json.dumps(proposal_obj)
    
    dify_data = {
        'inputs': {
            'input': json.dumps(qa_data)
        },
        'response_mode': 'streaming',
        'user': f"qa-user-{current_user.id}"
    }
    
    base_url = settings.api_endpoint
    headers = {
        "Authorization": f"Bearer {settings.qa_api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{base_url}/workflows/run", headers=headers, json=dify_data, stream=True)
        
        if response.status_code != 200:
            # エラーレスポンスの詳細を返す
            try:
                error_detail = response.json()
                return jsonify({'status': 'error', 'message': f'API呼び出しエラー: {response.status_code}', 'detail': error_detail})
            except:
                return jsonify({'status': 'error', 'message': f'API呼び出しエラー: {response.status_code}'})
        
        # ストリームからの最終レスポンスを取得
        final_output = {}
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith("data: "):
                    json_str = line_text[6:]
                    try:
                        event_data = json.loads(json_str)
                        event_type = event_data.get("event")
                        
                        if event_type == "workflow_finished":
                            final_output = event_data.get("data", {}).get("outputs", {})
                            break
                    except json.JSONDecodeError:
                        continue
        
        if not final_output:
            return jsonify({'status': 'error', 'message': 'API処理中にエラーが発生しました'})
        
        text_output = final_output.get("text", "{}")
        
        try:
            # サンプルコードと同様の抽出処理を実装
            content = json.loads(text_output) if isinstance(text_output, str) else text_output
            
            # textキーがある場合はその中身を取得（サンプルコードのextract_content関数と同等）
            if isinstance(content, dict) and "text" in content:
                content = json.loads(content["text"]) if isinstance(content["text"], str) else content["text"]
            
            return jsonify({'status': 'success', 'answer': content})
            
        except json.JSONDecodeError:
            # JSONでない場合は、テキストをそのまま返す
            return jsonify({'status': 'error', 'message': 'レスポンスの形式が正しくありません', 'raw_response': text_output})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'API呼び出し例外: {str(e)}'})

# ルート：会話生成
@app.route('/api/generate-conversation', methods=['POST'])
@login_required
def generate_conversation():
    data = request.get_json()
    
    settings = get_active_api_settings()
    
    if not settings or not settings.is_connected:
        return jsonify({'status': 'error', 'message': 'API接続が設定されていないか、接続テストに失敗しています'})
    
    # Dify APIに送信するデータ
    conversation_data = {
        'customer_name': data.get('customer_name', ''),
        'customer_details': data.get('customer_details', ''),
        'customer_type': data.get('customer_type', ''),
        'proposal': data.get('proposal', {})
    }
    
    # データサイズを確認してAPIの制限内に収まるようにする
    json_data = json.dumps(conversation_data)
    if len(json_data) > 45000:  # 50000文字の制限に余裕を持たせる
        # customer_detailsとreasonを短く切り詰める
        conversation_data['customer_details'] = conversation_data['customer_details'][:2000]
        if 'proposal' in conversation_data and isinstance(conversation_data['proposal'], dict):
            for section in ['car', 'payment', 'timing', 'trade_in']:
                if section in conversation_data['proposal'] and 'reason' in conversation_data['proposal'][section]:
                    conversation_data['proposal'][section]['reason'] = conversation_data['proposal'][section]['reason'][:1000]
    
    dify_data = {
        'inputs': {
            'input': json.dumps(conversation_data)
        },
        'response_mode': 'streaming',
        'user': f"conversation-user-{current_user.id}"
    }
    
    base_url = settings.api_endpoint
    headers = {
        "Authorization": f"Bearer {settings.salestalk_api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{base_url}/workflows/run", headers=headers, json=dify_data, stream=True)
        
        if response.status_code != 200:
            # エラーレスポンスの詳細を返す
            try:
                error_detail = response.json()
                return jsonify({'status': 'error', 'message': f'API呼び出しエラー: {response.status_code}', 'detail': error_detail})
            except:
                return jsonify({'status': 'error', 'message': f'API呼び出しエラー: {response.status_code}'})
        
        # ストリームからの最終レスポンスを取得
        final_output = {}
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith("data: "):
                    json_str = line_text[6:]
                    try:
                        event_data = json.loads(json_str)
                        event_type = event_data.get("event")
                        
                        if event_type == "workflow_finished":
                            final_output = event_data.get("data", {}).get("outputs", {})
                            break
                    except json.JSONDecodeError:
                        continue
        
        if not final_output:
            return jsonify({'status': 'error', 'message': 'API処理中にエラーが発生しました'})
        
        text_output = final_output.get("text", "{}")
        
        try:
            # テキスト出力がJSON文字列の場合、パースする
            content = json.loads(text_output) if isinstance(text_output, str) else text_output
            
            # contentがdictで、textキーがある場合は、そのテキストを再度パースする
            if isinstance(content, dict) and "text" in content:
                content = json.loads(content["text"]) if isinstance(content["text"], str) else content["text"]
            
            return jsonify({'status': 'success', 'conversation': content})
            
        except json.JSONDecodeError:
            # JSONでない場合は、テキストをそのまま返す
            return jsonify({'status': 'error', 'message': 'レスポンスの形式が正しくありません', 'raw_response': text_output})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'API呼び出し例外: {str(e)}'})

# ルート：履歴保存
@app.route('/api/save-history', methods=['POST'])
@login_required
def save_history():
    data = request.get_json()
    
    history = History(
        user_id=current_user.id,
        customer_name=data.get('customer_name', ''),
        customer_type=data.get('customer_type', ''),
        customer_details=data.get('customer_details', ''),
        dealer_info=data.get('dealer_info', ''),
        proposal_data=json.dumps(data.get('proposal', {})),
        car_model=data.get('car_model', ''),
        sales_talk=data.get('sales_talk', '')
    )
    
    db.session.add(history)
    db.session.commit()
    
    return jsonify({'status': 'success', 'id': history.id})

# ルート：履歴取得
@app.route('/api/get-history', methods=['GET'])
@login_required
def get_history():
    page = request.args.get('page', 1, type=int)
    per_page = 10
    
    # フィルタリング条件
    customer_name = request.args.get('customer_name', '')
    period = request.args.get('period', 'all')
    
    # 管理者は全ユーザーの履歴を参照可能、一般ユーザーは自分の履歴のみ
    if current_user.is_admin():
        query = History.query.join(User, History.user_id == User.id)
    else:
        query = History.query.join(User, History.user_id == User.id).filter(History.user_id == current_user.id)
    
    if customer_name:
        query = query.filter(History.customer_name.like(f'%{customer_name}%'))
    
    if period != 'all':
        from_date = get_date_filter(period)
        if from_date:
            query = query.filter(History.created_at >= from_date)
    
    pagination = query.order_by(History.created_at.desc()).paginate(page=page, per_page=per_page)
    
    result = []
    for item in pagination.items:
        result.append({
            'id': item.id,
            'customer_name': item.customer_name,
            'customer_type': item.customer_type,
            'car_model': item.car_model,
            'username': item.user.username,
            'created_at': to_jst(item.created_at).strftime('%Y/%m/%d %H:%M:%S')
        })
    
    return jsonify({
        'items': result,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

# ルート：履歴詳細
@app.route('/api/history/<int:history_id>', methods=['GET'])
@login_required
def get_history_detail(history_id):
    # 管理者は全履歴にアクセス可能、一般ユーザーは自分の履歴のみ
    if current_user.is_admin():
        history = History.query.options(db.joinedload(History.user)).filter_by(id=history_id).first()
    else:
        history = History.query.options(db.joinedload(History.user)).filter_by(id=history_id, user_id=current_user.id).first()
    
    if not history:
        return jsonify({'status': 'error', 'message': '履歴が見つかりません'})
    
    return jsonify({
        'id': history.id,
        'customer_name': history.customer_name,
        'customer_type': history.customer_type,
        'customer_details': history.customer_details,
        'dealer_info': history.dealer_info,
        'proposal': json.loads(history.proposal_data),
        'car_model': history.car_model,
        'sales_talk': history.sales_talk,
        'username': history.user.username,
        'created_at': to_jst(history.created_at).strftime('%Y/%m/%d %H:%M:%S')
    })

# ルート：履歴削除
@app.route('/api/history/<int:history_id>', methods=['DELETE'])
@login_required
def delete_history(history_id):
    # 管理者は全履歴を削除可能、一般ユーザーは自分の履歴のみ
    if current_user.is_admin():
        history = History.query.filter_by(id=history_id).first()
    else:
        history = History.query.filter_by(id=history_id, user_id=current_user.id).first()
    
    if not history:
        return jsonify({'status': 'error', 'message': '履歴が見つかりません'})
    
    db.session.delete(history)
    db.session.commit()
    
    return jsonify({'status': 'success'})

# ルート：履歴CSVエクスポート
@app.route('/api/export-history', methods=['GET'])
@login_required
def export_history():
    # フィルタリング条件
    customer_name = request.args.get('customer_name', '')
    period = request.args.get('period', 'all')
    
    # 管理者は全ユーザーの履歴をエクスポート可能、一般ユーザーは自分の履歴のみ
    if current_user.is_admin():
        query = History.query.join(User, History.user_id == User.id)
    else:
        query = History.query.join(User, History.user_id == User.id).filter(History.user_id == current_user.id)
    
    if customer_name:
        query = query.filter(History.customer_name.like(f'%{customer_name}%'))
    
    if period != 'all':
        from_date = get_date_filter(period)
        if from_date:
            query = query.filter(History.created_at >= from_date)
    
    # CSVの生成
    si = StringIO()
    cw = csv.writer(si)
    
    # ヘッダー（ユーザー名を追加）
    cw.writerow(['日時', 'ユーザー名', '顧客名', '顧客タイプ', '車種', '詳細'])
    
    # データ
    for item in query.order_by(History.created_at.desc()).all():
        cw.writerow([
            to_jst(item.created_at).strftime('%Y/%m/%d %H:%M:%S'),
            item.user.username,
            item.customer_name,
            item.customer_type,
            item.car_model,
            item.customer_details[:50] + ('...' if len(item.customer_details) > 50 else '')
        ])
    
    # CSVレスポンスの生成
    output = si.getvalue()
    
    return output, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=toyota_sales_history.csv'
    }

# メイン実行
if __name__ == '__main__':
    try:
        with app.app_context():
            db.create_all()
            
            # テスト用のユーザーがいない場合は作成
            if not User.query.filter_by(username='demo').first():
                demo_user = User(username='demo', password='demo', role='user')
                db.session.add(demo_user)
                db.session.commit()
                print("Demo user created successfully")
            else:
                print("Demo user already exists")
            
            # 管理者ユーザーがいない場合は作成
            if not User.query.filter_by(username='admin').first():
                admin_user = User(username='admin', password='admin', role='admin')
                db.session.add(admin_user)
                db.session.commit()
                print("Admin user created successfully")
            else:
                print("Admin user already exists")
        
        # OS自動判定による環境設定
        import platform
        is_windows = platform.system() == 'Windows'
        HOST = '127.0.0.1' if is_windows else '0.0.0.0'
        DEBUG = is_windows
        PORT = 5001 if is_windows else 80
        
        print(f"Starting Flask app on {HOST}:{PORT}...")
        app.run(debug=DEBUG, host=HOST, port=PORT)
    except Exception as e:
        print(f"Error starting application: {e}")
        import traceback
        traceback.print_exc() 