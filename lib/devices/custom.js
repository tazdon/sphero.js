"use strict";

// "custom" Sphero commands.
//
// These usually remix or pre-process arguments for existing methods.

var colors = require("../colors"),
    utils = require("../utils");

// regular expression to match hex strings
var hexRegex = /^[A-Fa-f0-9]{6}$/m;

/**
 * Converts a hex color number to RGB values
 *
 * @private
 * @param {Number} num color value to convert
 * @return {Object} RGB color values
 */
function hexToRGB(num) {
  return {
    red: (num >> 16 & 0xff),
    green: (num >> 8 & 0xff),
    blue: num & 0xff
  };
}

module.exports = function custom(device) {

  /**
   * The Color command wraps Sphero's built-in setRGB command, allowing for
   * a greater range of possible inputs.
   *
   * @param {Number|String|Object} color what color to change Sphero to
   * @param {Function} callback function to be triggered with response
   * @return {void}
   */
  device.color = function(color, callback) {
    switch (typeof color) {
      case "number":
        color = hexToRGB(color);
        break;

      case "string":
        if (colors[color]) {
          color = hexToRGB(colors[color]);
          break;
        }

        if (color[0] === "#") {
          color = color.slice(1);
        }

        if (hexRegex.test(color)) {
          var matches = hexRegex.exec(color);
          color = hexToRGB(parseInt(matches[0], 16));
        } else {
          // passed some weird value, just use white
          console.error("invalid color provided", color);
          color = hexToRGB(0xFFFFFF);
        }

        break;

      case "object":
        // upgrade shorthand properties
        ["red", "green", "blue"].forEach(function(hue) {
          var h = hue[0];

          if (color[h] && typeof color[hue] === "undefined") {
            color[hue] = color[h];
          }
        });

        break;
    }

    return device.setRGBLed(color, callback);
  };

  /**
   * The Random Color command sets Sphero to a randomly-generated color.
   *
   * @param {Function} callback function to be triggered with response
   * @return {void}
   */
  device.randomColor = function(callback) {
    return device.setRGBLed(utils.randomColor(), callback);
  };

  /**
   * Passes the color of the sphero RGB LED to the callback (err, data)
   *
   * @param {Function} callback function to be triggered with response
   * @return {void}
   */
  device.getColor = function(callback) {
    return device.getRGBLed(callback);
  };

  /**
   * The Detect Collisions command sets up Sphero's collision detection system,
   * and automatically parses asynchronous packets to re-emit collision events
   * to 'collision' event listeners.
   *
   * @param {Function} callback function to be triggered with response
   * @return {void}
   */
  device.detectCollisions = function(callback) {
    return device.configureCollisions({
      meth: 0x01,
      xt: 0x40,
      yt: 0x40,
      xs: 0x50,
      ys: 0x50,
      dead: 0x50
    }, callback);
  };

  /**
   * The Start Calibration command sets up Sphero for manual heading
   * calibration.
   *
   * It does this by turning on the tail light (so you can tell where it's
   * facing) and disabling stabilization (so you can adjust the heading).
   *
   * When done, call #finishCalibration to set the new heading, and re-enable
   * stabilization.
   *
   * @param {Function} callback function to be triggered with response
   * @return {void}
   */
  device.startCalibration = function(callback) {
    device.setBackLed(127);
    return device.setStabilization(0, callback);
  };

  /**
   * The Finish Calibration command ends Sphero's calibration mode, by setting
   * the new heading as current, turning off the back LED, and re-enabling
   * stabilization.
   *
   * @param {Function} callback function to be triggered with response
   * @return {void}
   */
  device.finishCalibration = function(callback) {
    device.setHeading(0);
    device.setBackLed(0);
    return device.setStabilization(1, callback);
  };

  /**
   * Generic data streaming setup
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` event or custom event to get the data.
   *
   * @param {Number} mask1 32bit data streaming bitmask (hex)
   * @param {Number} mask2 32bit data streaming bitmask (hex)
   * @param {Number} sps=5 samples per second
   * @param {Boolean} remove=false forces velocity streaming to stop
   * @param {Function} callback callback to be triggered on completion
   * @return {void}
   */
  device._streamData = function(mask1, mask2, sps, remove, callback) {
    sps = sps || 4;
    remove = remove || false;

    var n = Math.round(400 / sps),
        opts;

    mask1 = this._mergeMasks("mask1", mask1, remove);
    mask2 = this._mergeMasks("mask2", mask2, remove);

    // options for streaming data
    opts = {
      n: n,
      m: 1,
      mask1: mask1,
      pcnt: 0,
      mask2: mask2
    };

    device.on("dataStreaming", callback);
    device.setDataStreaming(opts);
  };

  device._mergeMasks = function(id, mask, remove) {
    if (remove) {
      mask = utils.xor32Bitmask(mask);
      mask = device.ds[id] & mask;
    } else {
      mask = device.ds[id] | mask;
    }

    return mask;
  };

  /**
   * Starts streaming of odometer data
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` or `odometer` event to get the data.
   *
   * @param {Number} [sps=5] samples per second
   * @param {Boolean} [remove=false] forces velocity streaming to stop
   * @return {void}
   */
  device.streamOdometer = function(sps, remove) {
    var mask1 = 0x00000000,
        mask2 = 0x0C000000;

    var callback = function(data) {
      device.emit("odometer", { x: data.xOdometer, y: data.yOdometer });
    };

    device._streamData(mask1, mask2, sps, remove, callback);
  };

  /**
   * Starts streaming of velocity data
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` or `velocity` event to get the velocity values.
   *
   * @param {Number} [sps=5] samples per second
   * @param {Boolean} [remove=false] forces velocity streaming to stop
   * @return {void}
   */
  device.streamVelocity = function(sps, remove) {
    var mask1 = 0x00000000,
        mask2 = 0x01800000;

    var callback = function(data) {
      device.emit("velocity", { x: data.xVelocity, y: data.yVelocity });
    };

    device._streamData(mask1, mask2, sps, remove, callback);
  };

  /**
   * Starts streaming of accelOne data
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` or `accelOne` event to get the data.
   *
   * @param {Number} [sps=5] samples per second
   * @param {Boolean} [remove=false] forces velocity streaming to stop
   * @return {void}
   */
  device.streamAccelOne = function(sps, remove) {
    var mask1 = 0x00000000,
        mask2 = 0x02000000;

    var callback = function(data) {
      device.emit("accelOne", data.accelOne);
    };

    device._streamData(mask1, mask2, sps, remove, callback);
  };

  /**
   * Starts streaming of IMU angles data
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` or `imuAngles` event to get the data.
   *
   * @param {Number} [sps=5] samples per second
   * @param {Boolean} [remove=false] forces velocity streaming to stop
   * @return {void}
   */
  device.streamIMUAngles = function(sps, remove) {
    var mask1 = 0x00070000,
        mask2 = 0x00000000;

    var callback = function(data) {
      device.emit("imuAngles", {
        pitchAngle: data.pitchAngle,
        rollAngle: data.rollAngle,
        yawAngle: data.yawAngle,
      });
    };

    device._streamData(mask1, mask2, sps, remove, callback);
  };

  /**
   * Starts streaming of accelerometer data
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` or `accelerometer` event to get the data.
   *
   * @param {Number} [sps=5] samples per second
   * @param {Boolean} [remove=false] forces velocity streaming to stop
   * @return {void}
   */
  device.streamAccelerometer = function(sps, remove) {
    var mask1 = 0x0000E000,
        mask2 = 0x00000000;

    var callback = function(data) {
      device.emit("accelerometer", {
        x: data.xAccel,
        y: data.yAccel,
        z: data.zAccel,
      });
    };

    device._streamData(mask1, mask2, sps, remove, callback);
  };

  /**
   * Starts streaming of gyroscope data
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` or `gyroscope` event to get the data.
   *
   * @param {Number} [sps=5] samples per second
   * @param {Boolean} [remove=false] forces velocity streaming to stop
   * @return {void}
   */
  device.streamGyroscope = function(sps, remove) {
    var mask1 = 0x00001C00,
        mask2 = 0x00000000;

    var callback = function(data) {
      device.emit("gyroscope", { x: data.xGyro, y: data.yGyro, z: data.zGyro });
    };

    device._streamData(mask1, mask2, sps, remove, callback);
  };

  /**
   * Starts streaming of motor back EMF data
   *
   * It uses sphero's data streaming command. User needs to listen
   * for the `dataStreaming` or `motorsBackEmf` event to get the data.
   *
   * @param {Number} [sps=5] samples per second
   * @param {Boolean} [remove=false] forces velocity streaming to stop
   * @return {void}
   */
  device.streamMotorsBackEmf = function(sps, remove) {
    var mask1 = 0x00000060,
        mask2 = 0x00000000;

    var callback = function(data) {
      device.emit("motorsBackEmf", {
        right: data.rMotorBackEMF,
        left: data.lMotorBackEMF
      });
    };

    device._streamData(mask1, mask2, sps, remove, callback);
  };
};