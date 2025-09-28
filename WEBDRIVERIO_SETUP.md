# WebDriverIO Remote Testing Setup

This guide shows how to run WebDriverIO tests against Android devices managed by this Device Farm from remote machines.

## Quick Start

1. **Start Appium Server**: Navigate to the Automation page and start an Appium server for your target device
2. **Get Configuration**: Copy the WebDriverIO configuration from the Automation page
3. **Run Tests**: Use the configuration in your WebDriverIO project

## Detailed Setup

### 1. Install WebDriverIO

```bash
npm install --save-dev @wdio/cli
npx wdio config
```

### 2. Example WebDriverIO Configuration

Replace the configuration from the Automation page in your `wdio.conf.js`:

```javascript
export const config = {
  runner: 'local',

  // Device Farm Server Details (replace with your server IP)
  hostname: 'your-device-farm-server.com',
  port: 4723, // Port from Automation page
  path: '/wd/hub',

  capabilities: [{
    platformName: 'Android',
    'appium:platformVersion': '13', // From device info
    'appium:deviceName': 'Samsung Galaxy S21',
    'appium:udid': 'device-serial-number',
    'appium:automationName': 'UiAutomator2',
    'appium:newCommandTimeout': 300,
    'appium:noReset': true,

    // Optional: Install app during test
    // 'appium:app': '/path/to/your/app.apk',
    // 'appium:appPackage': 'com.example.app',
    // 'appium:appActivity': '.MainActivity'
  }],

  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',

  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};
```

### 3. Example Test

```javascript
// test/example.e2e.js
describe('Android App Test', () => {
  it('should launch app and interact with elements', async () => {
    // Wait for app to load
    await driver.pause(3000);

    // Find and tap an element
    const button = await $('android=new UiSelector().text("Login")');
    await button.click();

    // Enter text
    const usernameField = await $('android=new UiSelector().resourceId("username")');
    await usernameField.setValue('testuser');

    // Take screenshot
    await driver.saveScreenshot('./test-screenshot.png');

    // Assertions
    const welcomeText = await $('android=new UiSelector().text("Welcome")');
    await expect(welcomeText).toBeDisplayed();
  });
});
```

### 4. Run Tests

```bash
npx wdio run wdio.conf.js
```

## API Endpoints

### Device Management

```bash
# List all devices
curl http://your-server:5000/api/devices

# Reserve a device
curl -X POST http://your-server:5000/api/devices/{deviceId}/reserve \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-user", "duration": 120, "purpose": "Testing"}'

# Release a device
curl -X POST http://your-server:5000/api/devices/{deviceId}/release
```

### Appium Server Management

```bash
# Start Appium server for a device
curl -X POST http://your-server:5000/api/devices/{deviceId}/appium/start

# Auto-start (reserve + start appium)
curl -X POST http://your-server:5000/api/devices/{deviceId}/appium/auto-start \
  -H "Content-Type: application/json" \
  -d '{"userId": "automation", "duration": 180, "purpose": "WebDriverIO Testing"}'

# Stop Appium server
curl -X POST http://your-server:5000/api/devices/{deviceId}/appium/stop

# Get server status
curl http://your-server:5000/api/devices/{deviceId}/appium/status

# List all running servers
curl http://your-server:5000/api/appium/servers
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Mobile Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Reserve device and start Appium
        run: |
          DEVICE_ID=$(curl -s http://${{ secrets.DEVICE_FARM_URL }}/api/devices | jq -r '.[0].id')
          curl -X POST http://${{ secrets.DEVICE_FARM_URL }}/api/devices/$DEVICE_ID/appium/auto-start \
            -H "Content-Type: application/json" \
            -d '{"userId": "ci", "duration": 60, "purpose": "CI Testing"}'

      - name: Run tests
        run: npx wdio run wdio.conf.js
        env:
          DEVICE_FARM_URL: ${{ secrets.DEVICE_FARM_URL }}

      - name: Cleanup
        if: always()
        run: |
          DEVICE_ID=$(curl -s http://${{ secrets.DEVICE_FARM_URL }}/api/devices | jq -r '.[0].id')
          curl -X POST http://${{ secrets.DEVICE_FARM_URL }}/api/devices/$DEVICE_ID/appium/stop
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any

    environment {
        DEVICE_FARM_URL = credentials('device-farm-url')
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm install'
            }
        }

        stage('Reserve Device') {
            steps {
                script {
                    def deviceId = sh(
                        script: "curl -s ${DEVICE_FARM_URL}/api/devices | jq -r '.[0].id'",
                        returnStdout: true
                    ).trim()

                    sh """
                        curl -X POST ${DEVICE_FARM_URL}/api/devices/${deviceId}/appium/auto-start \\
                        -H "Content-Type: application/json" \\
                        -d '{"userId": "jenkins", "duration": 90, "purpose": "Pipeline Testing"}'
                    """

                    env.DEVICE_ID = deviceId
                }
            }
        }

        stage('Run Tests') {
            steps {
                sh 'npx wdio run wdio.conf.js'
            }
        }
    }

    post {
        always {
            script {
                if (env.DEVICE_ID) {
                    sh "curl -X POST ${DEVICE_FARM_URL}/api/devices/${env.DEVICE_ID}/appium/stop"
                }
            }
        }
    }
}
```

## Troubleshooting

### Connection Issues
- Ensure the device farm server is accessible from your network
- Check firewall settings (ports 5000 for API, 4723+ for Appium)
- Verify device status is 'online' or 'reserved'

### Appium Issues
- Check if UIAutomator2 driver is installed: `npx appium driver list`
- Verify Android SDK and adb are working on the server
- Check device USB debugging is enabled

### Test Failures
- Increase timeout values in WebDriverIO config
- Use explicit waits instead of fixed pauses
- Check screenshot/video capabilities for debugging

## Advanced Features

### Parallel Testing
Configure multiple capabilities to run tests in parallel across multiple devices:

```javascript
capabilities: [
  {
    platformName: 'Android',
    'appium:deviceName': 'Device 1',
    // ... other configs
  },
  {
    platformName: 'Android',
    'appium:deviceName': 'Device 2',
    // ... other configs
  }
]
```

### Cloud Integration
You can integrate this device farm with cloud CI/CD services like:
- GitHub Actions
- Jenkins
- GitLab CI
- CircleCI
- Azure DevOps

The device farm provides REST APIs that work with any CI/CD system.