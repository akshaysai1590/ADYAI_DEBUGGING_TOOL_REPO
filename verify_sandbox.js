const http = require('http');

const IP = process.env.JUDGE0_IP;
const TOKEN = process.env.JUDGE0_TOKEN;

if (!IP || !TOKEN) {
    console.error("❌ Please set JUDGE0_IP and JUDGE0_TOKEN env variables.");
    process.exit(1);
}

const url = `http://${IP}:2358/submissions?base64_encoded=false&wait=true`;

const payload = JSON.stringify({
    source_code: "print('Python sandbox is working!')",
    language_id: 71 // Python 3
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': TOKEN
    }
};

console.log(`⏳ Testing Judge0 connection to ${IP}...`);

const req = http.request(url, options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode === 201) {
            const result = JSON.parse(data);
            if (result.stdout && result.stdout.trim() === 'Python sandbox is working!') {
                console.log('✅ SUCCESS! Judge0 is exposed and executing code securely.');
                console.log('Response:', result.stdout.trim());
            } else {
                console.log('❌ Code executed but output was wrong:', result);
            }
        } else {
            console.error(`❌ Connection failed. Status: ${res.statusCode}`);
            console.error(data);
            console.error('\nDid you remember to add the Ingress Rule for port 2358 in the Oracle Cloud Console?');
        }
    });
});

req.on('error', error => {
    console.error('❌ Network Error: Could not reach the server.');
    console.error(error.message);
    console.error('\nIf the server is running, this means the Oracle Cloud Firewall is blocking port 2358.');
});

req.write(payload);
req.end();
