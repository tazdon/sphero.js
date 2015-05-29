"use strict";

var Adaptor = lib("adaptors/serialport");

describe("Serialport Adaptor", function() {
  var adaptor;

  beforeEach(function() {
    adaptor = new Adaptor("/dev/rfcomm0");
  });

  it("is a class", function() {
    expect(Adaptor.constructor).to.be.a("function");
  });

  describe("#constructor", function() {
    it("sets @conn", function() {
      expect(adaptor.conn).to.be.eql("/dev/rfcomm0");

    });

    it("sets @serialport", function() {
      expect(adaptor.serialport).to.be.null;
    });

    it("sets @debug", function() {
      expect(adaptor.debug).not.to.be.null;
    });
  });

  describe("#open", function() {
    var callback, serialport;

    beforeEach(function() {
      callback = spy();

      serialport = { on: stub() };
      serialport.on.yields();

      stub(adaptor, "emit");
      stub(adaptor, "newSerialport");
      adaptor.newSerialport.returns(serialport);

      adaptor.open(callback);
    });

    afterEach(function() {
      adaptor.newSerialport.restore();
      adaptor.emit.restore();
    });

    it("sets @serialport to an instance of SerialPort", function() {
      expect(adaptor.newSerialport).to.be.calledOnce;
    });

    it("calls @serialport.on with open", function() {
      expect(adaptor.serialport.on).to.be.calledWith("open");
      expect(adaptor.emit).to.be.calledWith("open");
    });

    it("calls @serialport.on with error", function() {
      expect(adaptor.serialport.on).to.be.calledWith("error");
      expect(adaptor.emit).to.be.calledWith("error");
    });

    it("calls @serialport.on with data", function() {
      expect(adaptor.serialport.on).to.be.calledWith("data");
      expect(adaptor.emit).to.be.calledWith("close");
    });

    it("calls @serialport.on with close", function() {
      expect(adaptor.serialport.on).to.be.calledWith("data");
      expect(adaptor.emit).to.be.calledWith("data");
    });

    it("triggers the callback", function() {
      expect(callback).to.be.calledOnce;
    });

    it("calls callback with error when one present", function() {
      var err = new Error("Some Error!");
      serialport.on.yields(err);
      adaptor.open(callback);
      expect(callback).to.be.calledWith(err);
    });
  });

  describe("function", function() {
    var data, callback, serialport;

    beforeEach(function() {
      serialport = {
        write: stub(),
        close: stub()
      };

      stub(adaptor, "on");

      data = [0x0f, 0x10, 0x03];
      callback = spy();

      adaptor.serialport = serialport;
    });

    it("#write calls @serialport#write with", function() {
      adaptor.write(data, callback);
      expect(adaptor.serialport.write).to.be.calledWith(data, callback);
    });

    it("#onRead calls #on with", function() {
      adaptor.onRead(callback);
      expect(adaptor.on).to.be.calledWith("data", callback);
    });

    it("#onRead calls #on with", function() {
      adaptor.close(callback);
      expect(adaptor.serialport.close).to.be.calledWith(callback);
    });
  });

  // describe("#newSerialport", function() {
  //   it("creates a new instance of SerialPort", function() {
  //     var SerialPort = require("serialport").SerialPort;
  //     var serialport = adaptor.newSerialport();
  //     expect(serialport).to.be.an.instanceof(SerialPort);
  //   });
  // });
});

