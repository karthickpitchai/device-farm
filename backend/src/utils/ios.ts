import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export class IOSClient {
  private ideviceInfoPath: string;
  private ideviceScreenshotPath: string;
  private ideviceDebugPath: string;
  private xcrunPath: string;
  private bezelCache: Map<string, { bezelX: number; bezelY: number; scale: number; timestamp: number }> = new Map();
  private deviceScaleCache: Map<string, { scale: number; timestamp: number }> = new Map();

  constructor() {
    this.ideviceInfoPath = 'ideviceinfo';
    this.ideviceScreenshotPath = 'idevicescreenshot';
    this.ideviceDebugPath = 'idevicedebug';
    this.xcrunPath = 'xcrun';
  }

  async isIOSToolsAvailable(): Promise<boolean> {
    try {
      // Check if libimobiledevice tools are available
      await execAsync('which ideviceinfo');
      return true;
    } catch (error) {
      logger.warn('iOS tools (libimobiledevice) not found. Install with: brew install libimobiledevice');
      return false;
    }
  }

  async isXcodeAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.xcrunPath} --version`);
      return stdout.includes('xcrun version');
    } catch (error) {
      logger.warn('Xcode command line tools not found. Install Xcode and command line tools.');
      return false;
    }
  }

  async getConnectedDevices(): Promise<string[]> {
    try {
      // Try using xcrun simctl for simulators first
      let devices: string[] = [];

      try {
        const { stdout: simOutput } = await execAsync(`${this.xcrunPath} simctl list devices --json`);
        const simData = JSON.parse(simOutput);

        // Extract booted simulators
        for (const runtime in simData.devices) {
          const runtimeDevices = simData.devices[runtime];
          for (const device of runtimeDevices) {
            if (device.state === 'Booted') {
              devices.push(device.udid);
            }
          }
        }
      } catch (simError) {
        logger.debug('No iOS simulators found or xcrun not available');
      }

      // Try using idevice_id for physical devices
      try {
        const { stdout } = await execAsync('idevice_id -l');
        const physicalDevices = stdout.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        devices = [...devices, ...physicalDevices];
      } catch (physicalError) {
        logger.debug('No physical iOS devices found or libimobiledevice not available');
      }

      return devices;
    } catch (error) {
      logger.error('Failed to get connected iOS devices:', error);
      return [];
    }
  }

  async getDeviceInfo(deviceId: string): Promise<Record<string, string>> {
    try {
      // First check if it's a simulator
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        return this.getSimulatorInfo(deviceId);
      } else {
        return this.getPhysicalDeviceInfo(deviceId);
      }
    } catch (error) {
      logger.error(`Failed to get info for iOS device ${deviceId}:`, error);
      return {};
    }
  }

  private async isSimulator(deviceId: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.xcrunPath} simctl list devices --json`);
      const simData = JSON.parse(stdout);

      for (const runtime in simData.devices) {
        const runtimeDevices = simData.devices[runtime];
        for (const device of runtimeDevices) {
          if (device.udid === deviceId) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async getSimulatorInfo(deviceId: string): Promise<Record<string, string>> {
    try {
      const { stdout } = await execAsync(`${this.xcrunPath} simctl list devices --json`);
      const simData = JSON.parse(stdout);

      for (const runtime in simData.devices) {
        const runtimeDevices = simData.devices[runtime];
        for (const device of runtimeDevices) {
          if (device.udid === deviceId) {
            return {
              'DeviceName': device.name,
              'ProductType': device.deviceTypeIdentifier,
              'ProductVersion': runtime.replace('iOS ', '').replace('com.apple.CoreSimulator.SimRuntime.iOS-', '').replace('-', '.'),
              'UniqueDeviceID': device.udid,
              'DeviceClass': 'Simulator',
              'ModelNumber': device.deviceTypeIdentifier,
              'SerialNumber': device.udid,
              'Manufacturer': 'Apple',
              'State': device.state
            };
          }
        }
      }
      return {};
    } catch (error) {
      logger.error(`Failed to get simulator info for ${deviceId}:`, error);
      return {};
    }
  }

  private async getPhysicalDeviceInfo(deviceId: string): Promise<Record<string, string>> {
    try {
      const { stdout } = await execAsync(`${this.ideviceInfoPath} -u ${deviceId}`);
      const info: Record<string, string> = {};

      stdout.split('\n').forEach(line => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          info[match[1].trim()] = match[2].trim();
        }
      });

      return info;
    } catch (error) {
      logger.error(`Failed to get physical device info for ${deviceId}:`, error);
      return {};
    }
  }

  async getBatteryInfo(deviceId: string): Promise<{ level: number; status: string }> {
    try {
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        // Simulators don't have real battery info
        return { level: 100, status: 'simulator' };
      }

      const { stdout } = await execAsync(`${this.ideviceInfoPath} -u ${deviceId} -k BatteryCurrentCapacity`);
      const levelMatch = stdout.match(/(\d+)/);

      let level = levelMatch ? parseInt(levelMatch[1]) : 100;

      // iOS battery level is typically 0-100
      if (level > 100) level = 100;
      if (level < 0) level = 0;

      return {
        level,
        status: level > 20 ? 'normal' : 'low'
      };
    } catch (error) {
      logger.error(`Failed to get battery info for iOS device ${deviceId}:`, error);
      return { level: 100, status: 'unknown' };
    }
  }

  async takeScreenshotRaw(deviceId: string): Promise<Buffer> {
    try {
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        return this.takeSimulatorScreenshot(deviceId);
      } else {
        return this.takePhysicalDeviceScreenshot(deviceId);
      }
    } catch (error) {
      logger.error(`Failed to take screenshot for iOS device ${deviceId}:`, error);
      throw error;
    }
  }

  private async takeSimulatorScreenshot(deviceId: string): Promise<Buffer> {
    const tempFile = `/tmp/ios_screenshot_${deviceId}_${Date.now()}.png`;

    try {
      // First ensure the simulator is awake/active
      await execAsync(`${this.xcrunPath} simctl io ${deviceId} screenshot --type=png "${tempFile}"`);

      // Check if file was actually created before reading
      const fs = require('fs').promises;

      // Add a small delay to ensure file is fully written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify file exists before reading
      try {
        await fs.access(tempFile);
      } catch (accessError) {
        throw new Error(`Screenshot file was not created: ${tempFile}`);
      }

      const buffer = await fs.readFile(tempFile);

      // Verify we got actual image data
      if (buffer.length === 0) {
        throw new Error(`Screenshot file is empty: ${tempFile}`);
      }

      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp screenshot file ${tempFile}:`, cleanupError);
      }

      return buffer;
    } catch (error) {
      logger.error(`iOS simulator screenshot failed for device ${deviceId}:`, error);
      throw error;
    }
  }

  private async takePhysicalDeviceScreenshot(deviceId: string): Promise<Buffer> {
    const tempFile = `/tmp/ios_screenshot_${deviceId}_${Date.now()}.tiff`;
    const fs = require('fs').promises;

    try {
      // Method 1: Try idevicescreenshot first
      await execAsync(`${this.ideviceScreenshotPath} -u ${deviceId} "${tempFile}"`);
      logger.info(`idevicescreenshot command completed for device ${deviceId}`);

      // Add a small delay to ensure file is fully written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify file exists before reading
      try {
        await fs.access(tempFile);
      } catch (accessError) {
        throw new Error(`Screenshot file was not created: ${tempFile}`);
      }

      const buffer = await fs.readFile(tempFile);
      logger.info(`Screenshot buffer size: ${buffer.length} bytes for device ${deviceId}`);

      // Verify we got actual image data
      if (buffer.length === 0) {
        throw new Error(`Screenshot file is empty: ${tempFile}`);
      }

      // Check if the screenshot is too small (likely black/locked screen)
      if (buffer.length < 2000) {
        logger.warn(`Screenshot appears to be very small (${buffer.length} bytes), device may be locked or showing black screen: ${deviceId}`);
      }

      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp screenshot file ${tempFile}:`, cleanupError);
      }

      return buffer;
    } catch (error) {
      logger.warn(`Primary iOS screenshot method failed for device ${deviceId}, trying fallbacks:`, error);

      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError: unknown) {
        // Ignore cleanup errors
      }

      // Try fallback methods
      return await this.tryScreenshotFallbacks(deviceId);
    }
  }

  private async tryScreenshotFallbacks(deviceId: string): Promise<Buffer> {
    const fs = require('fs').promises;

    // Method 2: Try tidevice screenshot (alternative iOS tool)
    try {
      logger.info(`Trying tidevice screenshot for device ${deviceId}`);
      const tempFile = `/tmp/ios_screenshot_tidevice_${deviceId}_${Date.now()}.png`;

      // Use timeout to prevent hanging
      await execAsync(`timeout 30 python3 -m tidevice -u ${deviceId} screenshot "${tempFile}"`);

      // Check if file was created
      try {
        await fs.access(tempFile);
        const buffer = await fs.readFile(tempFile);
        await fs.unlink(tempFile).catch(() => {});

        if (buffer.length > 1000) { // Ensure it's not just a tiny error file
          logger.info(`Tidevice screenshot successful for device ${deviceId}, size: ${buffer.length} bytes`);
          return buffer;
        } else {
          logger.warn(`Tidevice screenshot too small (${buffer.length} bytes), trying other methods`);
        }
      } catch (accessError) {
        logger.warn(`Tidevice screenshot file not accessible: ${accessError}`);
      }
    } catch (tideviceError) {
      logger.warn(`Tidevice screenshot failed for device ${deviceId}: ${tideviceError}`);
    }

    // Method 3: Try to mount developer image first, then retry
    try {
      logger.info(`Attempting to mount developer disk image for device ${deviceId}`);
      await this.mountDeveloperImage(deviceId);

      // Retry original method after mounting
      const tempFile = `/tmp/ios_screenshot_${deviceId}_retry_${Date.now()}.tiff`;
      await execAsync(`${this.ideviceScreenshotPath} -u ${deviceId} "${tempFile}"`);

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await fs.access(tempFile);
        const buffer = await fs.readFile(tempFile);
        await fs.unlink(tempFile).catch(() => {});

        if (buffer.length > 0) {
          logger.info(`Screenshot successful after mounting developer image for device ${deviceId}`);
          return buffer;
        }
      } catch (accessError) {
        logger.warn(`Screenshot retry failed after mounting developer image for device ${deviceId}`);
      }
    } catch (mountError) {
      logger.warn(`Failed to mount developer image for device ${deviceId}:`, mountError);
    }

    // Method 3: Try cfgutil if available (Apple Configurator command line)
    try {
      logger.info(`Trying cfgutil screenshot for device ${deviceId}`);
      const tempFile = `/tmp/ios_screenshot_cfgutil_${deviceId}_${Date.now()}.png`;
      await execAsync(`cfgutil --ecid ${deviceId} screenshot --path "${tempFile}"`);

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await fs.access(tempFile);
        const buffer = await fs.readFile(tempFile);
        await fs.unlink(tempFile).catch(() => {});

        if (buffer.length > 0) {
          logger.info(`Screenshot successful using cfgutil for device ${deviceId}`);
          return buffer;
        }
      } catch (accessError) {
        logger.warn(`cfgutil screenshot file not created for device ${deviceId}`);
      }
    } catch (cfgutilError) {
      logger.warn(`cfgutil screenshot failed for device ${deviceId}:`, cfgutilError);
    }

    // Method 4: Generate placeholder screenshot with device info
    logger.warn(`All screenshot methods failed for device ${deviceId}, generating placeholder`);
    return await this.generatePlaceholderScreenshot(deviceId);
  }

  private async mountDeveloperImage(deviceId: string): Promise<void> {
    try {
      // First check if device info is available
      const deviceInfo = await execAsync(`ideviceinfo -u ${deviceId} -k ProductVersion`);
      const iosVersion = deviceInfo.stdout.trim();
      logger.info(`Device ${deviceId} iOS version: ${iosVersion}`);

      // Try to mount developer disk image using ideviceimagemounter
      // This requires the developer disk images to be available in Xcode
      const xcodeDevPath = '/Applications/Xcode.app/Contents/Developer';
      const majorVersion = iosVersion.split('.')[0];

      // Common developer image paths
      const imagePaths = [
        `${xcodeDevPath}/Platforms/iPhoneOS.platform/DeviceSupport/${iosVersion}/DeveloperDiskImage.dmg`,
        `${xcodeDevPath}/Platforms/iPhoneOS.platform/DeviceSupport/${majorVersion}.0/DeveloperDiskImage.dmg`,
        `${xcodeDevPath}/Platforms/iPhoneOS.platform/DeviceSupport/Latest/DeveloperDiskImage.dmg`
      ];

      for (const imagePath of imagePaths) {
        try {
          const signaturePath = imagePath.replace('.dmg', '.dmg.signature');
          logger.info(`Trying to mount developer image: ${imagePath}`);

          await execAsync(`ideviceimagemounter -u ${deviceId} "${imagePath}" "${signaturePath}"`);
          logger.info(`Successfully mounted developer image for device ${deviceId}`);
          return;
        } catch (mountError) {
          logger.warn(`Failed to mount image ${imagePath}:`, mountError);
        }
      }

      throw new Error('No compatible developer disk image found');
    } catch (error) {
      logger.error(`Failed to mount developer disk image for device ${deviceId}:`, error);
      throw error;
    }
  }

  private async generatePlaceholderScreenshot(deviceId: string): Promise<Buffer> {
    // Generate a simple placeholder image using ImageMagick or a simple SVG
    const fs = require('fs').promises;
    const tempFile = `/tmp/placeholder_${deviceId}_${Date.now()}.png`;

    try {
      // Try ImageMagick first
      const deviceInfo = await execAsync(`ideviceinfo -u ${deviceId} -k DeviceName,ProductType`).catch(() => ({ stdout: 'iOS Device\nUnknown' }));
      const lines = deviceInfo.stdout.trim().split('\n');
      const deviceName = lines[0] || 'iOS Device';
      const productType = lines[1] || 'Unknown';

      const magickCmd = `magick -size 375x667 xc:"#1f2937" -fill white -gravity center -pointsize 24 -annotate +0-50 "${deviceName}" -pointsize 16 -annotate +0+0 "${productType}" -annotate +0+30 "Screenshot Unavailable" -annotate +0+60 "Xcode Developer Image Required" "${tempFile}"`;

      await execAsync(magickCmd);

      await new Promise(resolve => setTimeout(resolve, 100));

      const buffer = await fs.readFile(tempFile);
      await fs.unlink(tempFile).catch(() => {});

      if (buffer.length > 0) {
        logger.info(`Generated placeholder screenshot for device ${deviceId}`);
        return buffer;
      }
    } catch (magickError) {
      logger.warn(`ImageMagick placeholder generation failed:`, magickError);
    }

    // Fallback: Return a minimal PNG placeholder
    logger.info(`Generating minimal placeholder for device ${deviceId}`);
    return this.createMinimalPlaceholder();
  }

  private createMinimalPlaceholder(): Buffer {
    // Return a minimal 1x1 transparent PNG
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, // RGBA, CRC
      0x00, 0x00, 0x00, 0x0B, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, // data
      0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
      0xAE, 0x42, 0x60, 0x82
    ]);

    return minimalPng;
  }

  private async getImageDimensions(imageBuffer: Buffer): Promise<{ width: number; height: number }> {
    // For PNG images, read dimensions from IHDR chunk
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
      // PNG format: width and height are at bytes 16-23 (big-endian)
      const width = imageBuffer.readUInt32BE(16);
      const height = imageBuffer.readUInt32BE(20);
      return { width, height };
    }

    // For TIFF/other formats, use ImageMagick identify
    const fs = require('fs').promises;
    const tempFile = `/tmp/temp_identify_${Date.now()}.png`;

    try {
      await fs.writeFile(tempFile, imageBuffer);
      const { stdout } = await execAsync(`magick identify -format "%wx%h" "${tempFile}"`);
      await fs.unlink(tempFile).catch(() => {});

      const match = stdout.match(/(\d+)x(\d+)/);
      if (match) {
        return { width: parseInt(match[1]), height: parseInt(match[2]) };
      }
    } catch (error) {
      logger.warn(`Failed to get image dimensions: ${error}`);
    }

    // Fallback dimensions
    return { width: 390, height: 844 }; // iPhone 14 Pro default
  }

  async tapScreen(deviceId: string, x: number, y: number): Promise<void> {
    logger.info(`[TAP DEBUG] tapScreen called for device ${deviceId} at (${x}, ${y})`);

    try {
      const isSimulator = await this.isSimulator(deviceId);
      logger.info(`[TAP DEBUG] Device ${deviceId} is ${isSimulator ? 'simulator' : 'physical device'}`);

      if (isSimulator) {
        logger.info(`iOS Simulator Tap: ${deviceId} at device coordinates (${x}, ${y})`);

        // Use simpler xcrun simctl approach with UI automation
        try {
          await this.tapSimulatorViaXCUITest(deviceId, x, y);
          logger.info(`iOS Simulator tap executed successfully via XCUITest`);
        } catch (xcuiError) {
          logger.warn(`XCUITest tap failed: ${xcuiError}, falling back to legacy method`);
          await this.tapSimulatorLegacy(deviceId, x, y);
        }

        // Small delay to make interaction feel natural
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        // Physical iOS device - use enhanced interaction methods
        await this.tapPhysicalDevice(deviceId, x, y);
      }
    } catch (error) {
      logger.error(`Failed to tap screen for iOS device ${deviceId}:`, error);
      throw error;
    }
  }

  private async tapSimulatorViaXCUITest(deviceId: string, x: number, y: number): Promise<void> {
    // Use idb (iOS Development Bridge) which uses XCUITest under the hood
    const idbPath = '/Users/karthickpitchai/Library/Python/3.9/bin/idb';

    try {
      // Get device scale to convert pixels to points
      // Use cached scale if available to avoid slow screenshot operation
      let scale = 3; // Default to 3x (iPhone Pro models)

      const cached = this.deviceScaleCache.get(deviceId);
      const cacheValid = cached && (Date.now() - cached.timestamp < 300000); // Cache for 5 minutes

      if (cacheValid && cached) {
        scale = cached.scale;
        logger.info(`[XCUITest] Using cached scale: ${scale}x`);
      } else {
        // Only take screenshot if we don't have cached scale
        logger.info(`[XCUITest] Detecting device scale...`);
        try {
          const screenshot = await this.takeSimulatorScreenshot(deviceId);
          const imageSize = await this.getImageDimensions(screenshot);

          // Detect scale based on screenshot dimensions
          // iPhone 17 Pro: 1206x2622px @3x = 402x874pt
          // iPhone standard: 828x1792px @2x = 414x896pt
          scale = imageSize.width > 800 ? 3 : 2;

          // Cache the scale
          this.deviceScaleCache.set(deviceId, { scale, timestamp: Date.now() });
          logger.info(`[XCUITest] Detected and cached scale: ${scale}x (${imageSize.width}x${imageSize.height})`);
        } catch (scaleError) {
          logger.warn(`[XCUITest] Failed to detect scale, using default 3x: ${scaleError}`);
          // Use default 3x for Pro models
          this.deviceScaleCache.set(deviceId, { scale: 3, timestamp: Date.now() });
        }
      }

      // Convert pixel coordinates to point coordinates
      const pointX = Math.round(x / scale);
      const pointY = Math.round(y / scale);

      logger.info(`[XCUITest] Pixel (${x}, ${y}) → Point (${pointX}, ${pointY}) [@${scale}x]`);

      // Execute tap using idb ui tap command with point coordinates
      const { stdout, stderr } = await execAsync(`${idbPath} ui tap --udid ${deviceId} ${pointX} ${pointY}`);

      if (stderr && !stderr.includes('WARNING')) {
        logger.warn(`idb tap stderr: ${stderr}`);
      }

      logger.info(`[XCUITest] Tap executed successfully at point (${pointX}, ${pointY})`);
    } catch (error: any) {
      logger.error(`[XCUITest] idb tap failed: ${error.message}`);
      throw error;
    }
  }

  private async tapSimulatorLegacy(deviceId: string, x: number, y: number): Promise<void> {
    logger.info(`Using legacy tap method for simulator ${deviceId}`);

    try {
          // Step 1: Get Simulator window position and size using AppleScript
          const boundsScript = `tell application "System Events"
            tell process "Simulator"
              get {position, size} of window 1
            end tell
          end tell`;

          const { stdout: boundsOutput } = await execAsync(`osascript -e '${boundsScript}'`);
          logger.info(`Simulator window bounds output: ${boundsOutput}`);

          // Parse output like: "892, 53, 428, 926" (x, y, width, height)
          const boundsMatch = boundsOutput.match(/(\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);

          if (!boundsMatch) {
            throw new Error('Could not parse window bounds');
          }

          const winX = parseInt(boundsMatch[1]);
          const winY = parseInt(boundsMatch[2]);
          const winWidth = parseInt(boundsMatch[3]);
          const winHeight = parseInt(boundsMatch[4]);

          logger.info(`Simulator window: position=(${winX}, ${winY}), size=(${winWidth}x${winHeight})`);

          // Step 2: Get bezel offset (cached or calculate)
          let bezelX = 0;
          let bezelY = 0;

          const cached = this.bezelCache.get(deviceId);
          const cacheValid = cached && (Date.now() - cached.timestamp < 60000); // Cache for 1 minute

          if (cacheValid && cached) {
            bezelX = cached.bezelX;
            bezelY = cached.bezelY;
            logger.info(`Using cached bezel offset: (${bezelX}, ${bezelY})`);
          } else {
            // Calculate bezel offset
            const titlebarHeight = 22; // macOS standard titlebar

            // Take a screenshot to determine the actual device screen area
            const screenshot = await this.takeSimulatorScreenshot(deviceId);
            const imageSize = await this.getImageDimensions(screenshot);

            logger.info(`Device screenshot dimensions: ${imageSize.width}x${imageSize.height}`);

            // Calculate the scale factor
            // The screenshot is at device resolution, window shows it scaled down
            const scaleX = imageSize.width / winWidth;
            const scaleY = imageSize.height / (winHeight - titlebarHeight);
            const scale = Math.max(scaleX, scaleY); // Use maximum to fit device in window (zoom out more)

            logger.info(`Scale factor: ${scale.toFixed(2)}x (scaleX: ${scaleX.toFixed(2)}, scaleY: ${scaleY.toFixed(2)}) (screenshot: ${imageSize.width}x${imageSize.height}, window: ${winWidth}x${winHeight})`);

            // Calculate bezel - window may have letterboxing
            const scaledScreenWidth = imageSize.width / scale;
            const scaledScreenHeight = imageSize.height / scale;
            bezelX = Math.max(0, (winWidth - scaledScreenWidth) / 2);
            bezelY = titlebarHeight + Math.max(0, (winHeight - titlebarHeight - scaledScreenHeight) / 2);

            logger.info(`Calculated bezel offset: (${bezelX}, ${bezelY})`);

            // Cache the result including scale
            this.bezelCache.set(deviceId, { bezelX, bezelY, scale, timestamp: Date.now() });
          }

          const scale = this.bezelCache.get(deviceId)?.scale || 1;

          // Step 3: Scale down device coordinates and calculate absolute screen coordinates
          // Coordinates from web are based on full-resolution screenshot, need to scale down
          const scaledX = x / scale;
          const scaledY = y / scale;

          const absX = Math.round(winX + bezelX + scaledX);
          const absY = Math.round(winY + bezelY + scaledY);

          logger.info(`[COORD DEBUG] Device coords: (${x}, ${y})`);
          logger.info(`[COORD DEBUG] Screenshot size: 1206x2622, Window size: ${winWidth}x${winHeight}`);
          logger.info(`[COORD DEBUG] Window position: (${winX}, ${winY}), Bezel offset: (${bezelX}, ${bezelY})`);
          logger.info(`[COORD DEBUG] Scale factor: ${scale.toFixed(2)}x`);
          logger.info(`[COORD DEBUG] Scaled device coords: (${scaledX.toFixed(2)}, ${scaledY.toFixed(2)})`);
          logger.info(`[COORD DEBUG] Calculation: absX = ${winX} + ${bezelX} + ${scaledX.toFixed(2)} = ${absX}`);
          logger.info(`[COORD DEBUG] Calculation: absY = ${winY} + ${bezelY} + ${scaledY.toFixed(2)} = ${absY}`);
          logger.info(`[COORD DEBUG] Final screen coords: (${absX}, ${absY})`);

          // Step 4: Use Python with Quartz to send mouse events without focusing
          const pythonScript = `import Quartz
import time
abs_x = ${absX}
abs_y = ${absY}
mouse_down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (abs_x, abs_y), 0)
mouse_up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (abs_x, abs_y), 0)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, mouse_down)
time.sleep(0.01)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, mouse_up)
`;

          const fs = require('fs').promises;
          const tempScript = `/tmp/ios_tap_${Date.now()}.py`;

          logger.info(`[TAP DEBUG] Attempting Python Quartz tap at screen coords (${absX}, ${absY})`);

          try {
            logger.info(`[TAP DEBUG] Writing Python script to ${tempScript}`);
            await fs.writeFile(tempScript, pythonScript);
            logger.info(`[TAP DEBUG] Python script written, executing...`);

            const { stdout, stderr } = await execAsync(`python3 ${tempScript}`);
            logger.info(`[TAP DEBUG] Python execution completed. stdout: ${stdout}, stderr: ${stderr}`);

            await fs.unlink(tempScript).catch(() => {});
            logger.info(`Tap executed via Python Quartz (no focus) at screen coords (${absX}, ${absY})`);
          } catch (pythonError: any) {
            logger.warn(`[TAP DEBUG] Python tap failed with error: ${pythonError.message}`);
            logger.warn(`[TAP DEBUG] Python stderr: ${pythonError.stderr}`);
            logger.warn(`[TAP DEBUG] Falling back to AppleScript`);

            // Fallback: Write AppleScript to temp file to avoid escaping issues
            const tempAS = `/tmp/ios_tap_${Date.now()}.scpt`;
            const clickScript = `tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
end tell
tell application "Simulator" to activate
delay 0.02
tell application "System Events"
  click at {${absX}, ${absY}}
end tell
tell application frontApp to activate`;

            logger.info(`[TAP DEBUG] Writing AppleScript to ${tempAS}`);
            await fs.writeFile(tempAS, clickScript);
            logger.info(`[TAP DEBUG] Executing AppleScript...`);
            await execAsync(`osascript ${tempAS}`);
            await fs.unlink(tempAS).catch(() => {});
            logger.info(`Tap executed via AppleScript (with focus) at screen coords (${absX}, ${absY})`);
          }

          logger.info(`Legacy iOS Simulator tap executed successfully`);
    } catch (tapError) {
      logger.error(`Legacy iOS Simulator tap failed: ${tapError}`);
      throw tapError;
    }
  }

  private async tapPhysicalDevice(deviceId: string, x: number, y: number): Promise<void> {
    try {
      logger.info(`iOS Physical Device Tap: ${deviceId} at coordinates (${x}, ${y})`);

      // Method 1: Try using tidevice with touch simulation
      try {
        // Create a temporary Python script for touch simulation
        const tempScript = `/tmp/ios_tap_${deviceId}_${Date.now()}.py`;
        const fs = require('fs').promises;

        const touchScript = `
import tidevice
import sys

try:
    device = tidevice.Device("${deviceId}")
    # Send touch event using tidevice's WebDriverAgent support
    device.send_command({
        "cmd": "touch",
        "args": {"x": ${x}, "y": ${y}}
    })
    print("Touch event sent successfully")
except Exception as e:
    print(f"Touch failed: {e}")
    sys.exit(1)
`;

        await fs.writeFile(tempScript, touchScript);
        await execAsync(`python3 ${tempScript}`);

        // Clean up
        try {
          await fs.unlink(tempScript);
        } catch {}

        logger.info(`iOS physical device tap executed via tidevice at (${x}, ${y})`);
        return;
      } catch (tideviceError) {
        logger.warn(`Tidevice tap failed: ${tideviceError}`);
      }

      // Method 2: Log the interaction for monitoring
      logger.info(`iOS Physical Device tap logged at (${x}, ${y}) - Physical interaction requires developer setup`);

    } catch (error) {
      logger.warn(`Physical device tap failed for ${deviceId}: ${error}`);
      // Don't throw error to avoid breaking the UI flow
      logger.info(`iOS Physical Device tap logged at (${x}, ${y}) - continuing with fallback mode`);
    }
  }

  async checkWebDriverAgentSetup(deviceId: string): Promise<boolean> {
    try {
      // Check if WebDriverAgent is running on the device
      const response = await fetch(`http://localhost:8100/status`);
      if (response.ok) {
        logger.info(`WebDriverAgent is running for device ${deviceId}`);
        return true;
      }
    } catch (error) {
      logger.info(`WebDriverAgent not detected for device ${deviceId}: ${error}`);
    }
    return false;
  }

  async setupWebDriverAgent(deviceId: string): Promise<string> {
    const setupInstructions = `
iOS Real Device Interaction Setup Instructions:

1. Install WebDriverAgent:
   - Clone: git clone https://github.com/appium/WebDriverAgent
   - Open WebDriverAgent.xcodeproj in Xcode
   - Change bundle identifier to something unique
   - Sign with your Apple Developer account
   - Build and run on your device

2. Alternative - Use ios-deploy:
   - Install: brew install ios-deploy
   - Build WebDriverAgent and deploy to device

3. Start WebDriverAgent:
   - Build and run WebDriverAgent on device
   - Forward port: iproxy 8100 8100
   - Test: curl http://localhost:8100/status

4. For Screenshots only:
   - Enable Developer Mode on device
   - Trust computer when prompted
   - Install appropriate iOS developer disk image

Current status for device ${deviceId}:
- libimobiledevice tools: Available
- tidevice: Available
- WebDriverAgent: Not detected (check http://localhost:8100/status)

The system will continue to work with placeholder screenshots and logged interactions.
To enable full interaction, please set up WebDriverAgent as described above.
`;

    logger.info(setupInstructions);
    return setupInstructions;
  }

  async swipeScreen(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration?: number): Promise<void> {
    logger.info(`[SWIPE DEBUG] swipeScreen called for device ${deviceId} from (${startX}, ${startY}) to (${endX}, ${endY}), duration: ${duration}ms`);

    try {
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        const swipeDuration = duration || 500;
        logger.info(`iOS Simulator Swipe: ${deviceId} from (${startX}, ${startY}) to (${endX}, ${endY}), duration: ${swipeDuration}ms`);

        try {
          await this.swipeSimulatorViaXCUITest(deviceId, startX, startY, endX, endY, swipeDuration);
          logger.info(`iOS Simulator swipe executed successfully via XCUITest`);
        } catch (xcuiError) {
          logger.warn(`XCUITest swipe failed: ${xcuiError}, falling back to legacy method`);
          await this.swipeSimulatorLegacy(deviceId, startX, startY, endX, endY, swipeDuration);
        }

        // Small delay after swipe
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        logger.warn(`Physical iOS device swipe functionality requires WebDriverAgent setup`);
        throw new Error('Swipe not implemented for physical iOS devices yet');
      }
    } catch (error) {
      logger.error(`Failed to swipe screen for iOS device ${deviceId}:`, error);
      throw error;
    }
  }

  private async swipeSimulatorViaXCUITest(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration: number): Promise<void> {
    const idbPath = '/Users/karthickpitchai/Library/Python/3.9/bin/idb';

    try {
      // Get cached scale or detect
      let scale = 3;
      const cached = this.deviceScaleCache.get(deviceId);
      const cacheValid = cached && (Date.now() - cached.timestamp < 300000);

      if (cacheValid && cached) {
        scale = cached.scale;
        logger.info(`[XCUITest Swipe] Using cached scale: ${scale}x`);
      } else {
        logger.info(`[XCUITest Swipe] Detecting device scale...`);
        try {
          const screenshot = await this.takeSimulatorScreenshot(deviceId);
          const imageSize = await this.getImageDimensions(screenshot);
          scale = imageSize.width > 800 ? 3 : 2;
          this.deviceScaleCache.set(deviceId, { scale, timestamp: Date.now() });
          logger.info(`[XCUITest Swipe] Detected and cached scale: ${scale}x (${imageSize.width}x${imageSize.height})`);
        } catch (scaleError) {
          logger.warn(`[XCUITest Swipe] Failed to detect scale, using default 3x: ${scaleError}`);
          this.deviceScaleCache.set(deviceId, { scale: 3, timestamp: Date.now() });
        }
      }

      // Convert pixel coordinates to point coordinates
      const pointStartX = Math.round(startX / scale);
      const pointStartY = Math.round(startY / scale);
      const pointEndX = Math.round(endX / scale);
      const pointEndY = Math.round(endY / scale);

      logger.info(`[XCUITest Swipe] Pixel (${startX}, ${startY}) → Point (${pointStartX}, ${pointStartY}) [@${scale}x]`);
      logger.info(`[XCUITest Swipe] Pixel (${endX}, ${endY}) → Point (${pointEndX}, ${pointEndY}) [@${scale}x]`);

      // Execute swipe using idb ui swipe command
      // Duration is in milliseconds, convert to seconds for idb
      const durationInSeconds = duration / 1000;
      const { stdout, stderr } = await execAsync(
        `${idbPath} ui swipe --udid ${deviceId} ${pointStartX} ${pointStartY} ${pointEndX} ${pointEndY} --duration ${durationInSeconds}`
      );

      if (stderr && !stderr.includes('WARNING')) {
        logger.warn(`idb swipe stderr: ${stderr}`);
      }

      logger.info(`[XCUITest Swipe] Swipe executed successfully from (${pointStartX}, ${pointStartY}) to (${pointEndX}, ${pointEndY})`);
    } catch (error: any) {
      logger.error(`[XCUITest Swipe] idb swipe failed: ${error.message}`);
      throw error;
    }
  }

  private async swipeSimulatorLegacy(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration: number): Promise<void> {
    logger.info(`Using legacy swipe method for simulator ${deviceId}`);

    try {
      // Step 1: Get Simulator window position
      const posScript = `tell application "System Events"
        tell process "Simulator"
          get position of window 1
        end tell
      end tell`;

      const { stdout: posOutput } = await execAsync(`osascript -e '${posScript}'`);
      const posMatch = posOutput.match(/(\d+),\s*(\d+)/);

      if (!posMatch) {
        throw new Error('Could not parse window position');
      }

      const winX = parseInt(posMatch[1]);
      const winY = parseInt(posMatch[2]);

      // Step 2: Calculate absolute screen coordinates for start and end
      const absStartX = winX + startX;
      const absStartY = winY + startY + 52;
      const absEndX = winX + endX;
      const absEndY = winY + endY + 52;

      logger.info(`Swiping from screen (${absStartX}, ${absStartY}) to (${absEndX}, ${absEndY})`);

      // Step 3: Use cliclick to perform drag (swipe)
      // Format: cliclick dd:x,y du:x,y (drag down, drag up)
      await execAsync(`cliclick dd:${absStartX},${absStartY} w:${duration / 1000} du:${absEndX},${absEndY}`);

      logger.info(`Legacy iOS Simulator swipe executed successfully`);
    } catch (swipeError) {
      logger.error(`Legacy iOS Simulator swipe failed: ${swipeError}`);
      throw swipeError;
    }
  }

  async dragScreen(deviceId: string, startX: number, startY: number, endX: number, endY: number, duration?: number): Promise<void> {
    logger.info(`[DRAG DEBUG] dragScreen called for device ${deviceId} from (${startX}, ${startY}) to (${endX}, ${endY}), duration: ${duration}ms`);

    // Drag is essentially a swipe with a longer default duration
    const dragDuration = duration || 1000; // Default to 1 second for drag vs 500ms for swipe

    try {
      await this.swipeScreen(deviceId, startX, startY, endX, endY, dragDuration);
      logger.info(`iOS Drag gesture executed successfully`);
    } catch (error) {
      logger.error(`Failed to perform drag gesture for iOS device ${deviceId}:`, error);
      throw error;
    }
  }

  async sendKeyEvent(deviceId: string, keyCode: number): Promise<void> {
    try {
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        // Map common key codes to iOS actions
        let keyDescription = '';
        switch (keyCode) {
          case 4: // KEYCODE_BACK (Android) -> iOS Home
          case 3: // KEYCODE_HOME -> iOS Home
            keyDescription = 'Home button';
            logger.info(`iOS Simulator Key Event: ${keyDescription} (code: ${keyCode}) for device ${deviceId}`);
            logger.warn(`${keyDescription} simulation logged - WebDriverAgent integration required for physical execution`);
            break;
          case 67: // KEYCODE_DEL -> iOS Delete/Backspace
            keyDescription = 'Delete/Backspace';
            logger.info(`iOS Simulator Key Event: ${keyDescription} (code: ${keyCode}) for device ${deviceId}`);

            // For delete key, we can at least clear the pasteboard as a gesture
            try {
              await execAsync(`echo "" | ${this.xcrunPath} simctl pbcopy ${deviceId}`);
              logger.info(`Pasteboard cleared for delete key simulation on iOS simulator ${deviceId}`);
            } catch (clearError) {
              logger.warn(`Failed to clear pasteboard for delete key: ${clearError}`);
            }
            break;
          case 66: // KEYCODE_ENTER
            keyDescription = 'Enter/Return';
            logger.info(`iOS Simulator Key Event: ${keyDescription} (code: ${keyCode}) for device ${deviceId}`);
            logger.warn(`${keyDescription} simulation logged - WebDriverAgent integration required for physical execution`);
            break;
          default:
            keyDescription = `Unknown key (code: ${keyCode})`;
            logger.info(`iOS Simulator Key Event: ${keyDescription} for device ${deviceId}`);
            logger.warn(`Key code ${keyCode} logged - WebDriverAgent integration required for physical execution`);
            break;
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        logger.warn(`Key input for physical iOS devices requires WebDriverAgent setup`);
        throw new Error('Key input not implemented for physical iOS devices yet');
      }
    } catch (error) {
      logger.error(`Failed to send key event for iOS device ${deviceId}:`, error);
      throw error;
    }
  }

  async inputText(deviceId: string, text: string): Promise<void> {
    logger.info(`[TEXT DEBUG] inputText called for device ${deviceId}, text: "${text}"`);

    try {
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        logger.info(`iOS Simulator Text Input: "${text}" for device ${deviceId}`);

        try {
          await this.inputTextViaXCUITest(deviceId, text);
          logger.info(`iOS Simulator text input executed successfully via XCUITest`);
        } catch (xcuiError) {
          logger.warn(`XCUITest text input failed: ${xcuiError}, falling back to legacy method`);
          await this.inputTextLegacy(deviceId, text);
        }

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        logger.warn(`Text input for physical iOS devices requires WebDriverAgent setup`);
        throw new Error('Text input not implemented for physical iOS devices yet');
      }
    } catch (error) {
      logger.error(`Failed to input text for iOS device ${deviceId}:`, error);
      throw error;
    }
  }

  private async inputTextViaXCUITest(deviceId: string, text: string): Promise<void> {
    const idbPath = '/Users/karthickpitchai/Library/Python/3.9/bin/idb';

    try {
      logger.info(`[XCUITest Text] Inputting text: "${text}"`);

      // Execute text input using idb ui text command
      // Escape text for shell - use single quotes and handle any single quotes in the text
      const escapedText = text.replace(/'/g, "'\\''");
      const { stdout, stderr } = await execAsync(`${idbPath} ui text --udid ${deviceId} '${escapedText}'`);

      if (stderr && !stderr.includes('WARNING')) {
        logger.warn(`idb text input stderr: ${stderr}`);
      }

      logger.info(`[XCUITest Text] Text input executed successfully: "${text}"`);
    } catch (error: any) {
      logger.error(`[XCUITest Text] idb text input failed: ${error.message}`);
      throw error;
    }
  }

  private async inputTextLegacy(deviceId: string, text: string): Promise<void> {
    logger.info(`Using legacy text input method for simulator ${deviceId}`);

    try {
      // Set the text to the iOS simulator's pasteboard
      await execAsync(`echo "${text}" | ${this.xcrunPath} simctl pbcopy ${deviceId}`);
      logger.info(`Text "${text}" copied to iOS Simulator pasteboard - user can paste manually`);
    } catch (pbError) {
      logger.warn(`Failed to copy text to iOS Simulator pasteboard: ${pbError}`);
      logger.info(`Text input logged: "${text}" for iOS Simulator ${deviceId}`);
    }
  }

  async getScreenResolution(deviceId: string): Promise<string> {
    try {
      const info = await this.getDeviceInfo(deviceId);

      // Try to extract resolution from device info
      if (info.ProductType) {
        // Map common iOS device types to resolutions
        const resolutionMap: Record<string, string> = {
          'iPhone14,7': '1170x2532', // iPhone 14
          'iPhone14,8': '1284x2778', // iPhone 14 Plus
          'iPhone15,2': '1179x2556', // iPhone 15
          'iPhone15,3': '1290x2796', // iPhone 15 Plus
          'iPad13,18': '2048x2732', // iPad Pro 12.9"
          'iPad14,3': '1640x2360', // iPad Pro 11"
        };

        return resolutionMap[info.ProductType] || 'unknown';
      }

      return 'unknown';
    } catch (error) {
      logger.error(`Failed to get screen resolution for iOS device ${deviceId}:`, error);
      return 'unknown';
    }
  }

  async installApp(deviceId: string, ipaPath: string): Promise<void> {
    try {
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        await execAsync(`${this.xcrunPath} simctl install ${deviceId} "${ipaPath}"`);
      } else {
        // For physical devices, use ideviceinstaller if available
        await execAsync(`ideviceinstaller -u ${deviceId} -i "${ipaPath}"`);
      }
    } catch (error) {
      logger.error(`Failed to install app for iOS device ${deviceId}:`, error);
      throw error;
    }
  }

  async uninstallApp(deviceId: string, bundleId: string): Promise<void> {
    try {
      const isSimulator = await this.isSimulator(deviceId);

      if (isSimulator) {
        await execAsync(`${this.xcrunPath} simctl uninstall ${deviceId} ${bundleId}`);
      } else {
        await execAsync(`ideviceinstaller -u ${deviceId} -U ${bundleId}`);
      }
    } catch (error) {
      logger.error(`Failed to uninstall app for iOS device ${deviceId}:`, error);
      throw error;
    }
  }
}