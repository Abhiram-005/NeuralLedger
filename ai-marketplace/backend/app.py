from flask import Flask, request, jsonify
from flask_cors import CORS
from web3 import Web3
import json
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)

# ─── Blockchain Setup ───────────────────────────────────────────
w3 = Web3(Web3.HTTPProvider('http://127.0.0.1:8545'))

with open('../build/contracts/AIModelRegistry.json') as f:
    contract_json = json.load(f)
    contract_abi  = contract_json['abi']

CONTRACT_ADDRESS = '0x61D9CbDeCA770e4949BEE8CBf4361eD8C0c48B4F'
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)
w3.eth.default_account = w3.eth.accounts[0]

# ─── In-memory store of model feature vectors (for plagiarism detection) ───
registered_vectors = {}   # { model_id: feature_vector }

# ─── AI MODULE 1: RandomForest Quality Scorer ───────────────────
def train_quality_scorer():
    np.random.seed(42)
    n = 800

    accuracy      = np.random.uniform(30, 99, n)
    model_size    = np.random.uniform(1, 500, n)
    parameters    = np.random.uniform(0.1, 1000, n)
    training_time = np.random.uniform(1, 100, n)
    val_loss      = np.random.uniform(0.01, 2.0, n)

    score = (
        accuracy * 0.45 +
        np.log1p(parameters) / np.log1p(1000) * 20 +
        (1 - np.clip(val_loss / 2.0, 0, 1)) * 20 +
        np.clip(model_size / 500, 0, 1) * 10 +
        np.log1p(training_time) / np.log1p(100) * 5
    )
    score = np.clip(score, 0, 100)

    X = np.column_stack([accuracy, model_size, parameters, training_time, val_loss])
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    rf = RandomForestRegressor(n_estimators=150, random_state=42)
    rf.fit(X_scaled, score)
    return rf, scaler

print("🧠 Training RandomForest Quality Scorer...")
rf_model, rf_scaler = train_quality_scorer()
print("✅ Quality Scorer Ready!")

def get_quality_score(accuracy, model_size, parameters, training_time, val_loss):
    X = np.array([[accuracy, model_size, parameters, training_time, val_loss]])
    X_scaled = rf_scaler.transform(X)
    score = rf_model.predict(X_scaled)[0]
    return round(float(np.clip(score, 0, 100)), 2)

# ─── AI MODULE 2: Plagiarism Detector (Cosine Similarity) ────────
def build_feature_vector(accuracy, model_size, parameters, training_time, val_loss):
    """
    Converts model metrics into a normalized feature vector.
    This vector is used to compare models using cosine similarity.
    """
    vec = np.array([
        accuracy / 100.0,
        model_size / 500.0,
        np.log1p(parameters) / np.log1p(1000),
        training_time / 100.0,
        1 - (val_loss / 2.0)
    ])
    return vec

def check_plagiarism(new_vector):
    """
    Compares new model vector against all registered model vectors.
    Returns highest similarity score and which model it matched.
    """
    if not registered_vectors:
        return 0.0, None   # No models registered yet

    ids    = list(registered_vectors.keys())
    matrix = np.array([registered_vectors[i] for i in ids])

    # Cosine similarity — AI technique used in NLP, recommendation systems
    similarities = cosine_similarity([new_vector], matrix)[0]

    max_idx   = int(np.argmax(similarities))
    max_score = float(similarities[max_idx])
    matched_id = ids[max_idx]

    return round(max_score * 100, 2), matched_id   # return as percentage

# ─── ROUTES ──────────────────────────────────────────────────────

@app.route('/register', methods=['POST'])
def register_model():
    try:
        data          = request.json
        name          = data['name']
        description   = data['description']
        model_hash    = data['modelHash']
        price         = int(data['price'])
        accuracy      = float(data['accuracy'])
        model_size    = float(data['modelSize'])
        parameters    = float(data['parameters'])
        training_time = float(data.get('trainingTime', 10))
        val_loss      = float(data.get('valLoss', 0.3))

        # ── AI Step 1: Build feature vector
        new_vector = build_feature_vector(accuracy, model_size, parameters, training_time, val_loss)

        # ── AI Step 2: Check plagiarism BEFORE registering
        similarity_score, matched_id = check_plagiarism(new_vector)
        uniqueness_score = round(100 - similarity_score, 2)

        # ── AI Step 3: Quality score using RandomForest
        quality_score = get_quality_score(accuracy, model_size, parameters, training_time, val_loss)

        # ── Blockchain: Register model
        tx_hash = contract.functions.registerModel(
            name, description, model_hash, price
        ).transact()
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        # ── Blockchain: Store quality score on-chain
        model_id = contract.functions.modelCount().call()
        tx2 = contract.functions.updateQualityScore(model_id, int(quality_score)).transact()
        w3.eth.wait_for_transaction_receipt(tx2)

        # ── Store vector in memory for future plagiarism checks
        registered_vectors[model_id] = new_vector.tolist()

        block = w3.eth.get_block(receipt['blockNumber'])

        return jsonify({
            'success': True,
            'modelId': model_id,
            'ai': {
                'qualityScore': quality_score,
                'uniquenessScore': uniqueness_score,
                'similarityScore': similarity_score,
                'matchedModelId': matched_id,
                'plagiarismRisk': 'HIGH' if similarity_score > 80 else 'MEDIUM' if similarity_score > 50 else 'LOW'
            },
            'blockchain': {
                'txHash': tx_hash.hex(),
                'blockNumber': receipt['blockNumber'],
                'blockTimestamp': block['timestamp'],
                'gasUsed': receipt['gasUsed'],
                'contractAddress': CONTRACT_ADDRESS,
                'registeredBy': w3.eth.default_account
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/models', methods=['GET'])
def get_models():
    try:
        count  = contract.functions.modelCount().call()
        models = []
        for i in range(1, count + 1):
            m = contract.functions.getModel(i).call()
            models.append({
                'id': m[0], 'name': m[1], 'description': m[2],
                'modelHash': m[3], 'owner': m[4], 'price': m[5],
                'qualityScore': m[6], 'timestamp': m[7], 'isForSale': m[8]
            })
        return jsonify({'success': True, 'models': models})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/buy', methods=['POST'])
def buy_model():
    try:
        data     = request.json
        model_id = int(data['modelId'])
        buyer    = data['buyerAddress']

        m     = contract.functions.getModel(model_id).call()
        price = m[5]

        tx_hash = contract.functions.buyModel(model_id).transact({
            'from': buyer, 'value': price
        })
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        block   = w3.eth.get_block(receipt['blockNumber'])

        return jsonify({
            'success': True,
            'blockchain': {
                'txHash': tx_hash.hex(),
                'blockNumber': receipt['blockNumber'],
                'blockTimestamp': block['timestamp'],
                'gasUsed': receipt['gasUsed'],
                'newOwner': buyer,
                'pricePaid': price
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/accounts', methods=['GET'])
def get_accounts():
    try:
        result = []
        for acc in w3.eth.accounts:
            bal = w3.eth.get_balance(acc)
            result.append({
                'address': acc,
                'balance': str(w3.from_wei(bal, 'ether'))
            })
        return jsonify({'success': True, 'accounts': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/check-plagiarism', methods=['POST'])
def check_plagiarism_route():
    """Preview plagiarism score before registering"""
    try:
        data          = request.json
        accuracy      = float(data['accuracy'])
        model_size    = float(data['modelSize'])
        parameters    = float(data['parameters'])
        training_time = float(data.get('trainingTime', 10))
        val_loss      = float(data.get('valLoss', 0.3))

        vec = build_feature_vector(accuracy, model_size, parameters, training_time, val_loss)
        similarity, matched = check_plagiarism(vec)
        uniqueness = round(100 - similarity, 2)

        return jsonify({
            'success': True,
            'uniquenessScore': uniqueness,
            'similarityScore': similarity,
            'matchedModelId': matched,
            'risk': 'HIGH' if similarity > 80 else 'MEDIUM' if similarity > 50 else 'LOW'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)