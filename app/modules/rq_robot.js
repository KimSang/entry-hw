const _ = require('lodash');
const BaseModule = require('./baseModule');

class rq_robot extends BaseModule {
    constructor() {
        super();
        this.counter = 0;
        this.commandResponseSize = 8;
        this.wholeResponseSize = 0x32;
        this.isSendInitData = false;
        this.isSensorCheck = false;
        this.isConnect = false;

        this.sp = null;
        this.handler = null;
        this.config = null;

        this.sensors = [];
        this.CHECK_PORT_MAP = {};
        this.SENSOR_COUNTER_LIST = {};
        this.returnData = {};
        this.motorMovementTypes = {
            Degrees: 0,
            Power: 1,
        };
        this.deviceTypes = {
            NxtTouch: 1,
            NxtLight: 2,
            NxtSound: 3,
            NxtColor: 4,
            NxtUltrasonic: 5,
            NxtTemperature: 6,
            LMotor: 7,
            MMotor: 8,
            Touch: 0x0e,
            Color: 0x1d,
            Ultrasonic: 0x1e,
            Gyroscope: 0x20,
            Infrared: 0x21,
            Initializing: 0x7d,
            Empty: 0x7e, // 126
            WrongPort: 0x7f,
            Unknown: 0xff,
        };
        this.outputPort = {
            A: 1,
            B: 2,
            C: 4,
            D: 8,
            ALL: 0x0f,
        };
        this.PORT_MAP = {
            A: {
                type: this.motorMovementTypes.Power,
                power: 0,
            },
            B: {
                type: this.motorMovementTypes.Power,
                power: 0,
            },
            C: {
                type: this.motorMovementTypes.Power,
                power: 0,
            },
            D: {
                type: this.motorMovementTypes.Power,
                power: 0,
            },
        };
        this.BUTTON_MAP = {
            UP: {
                key: 1,
            },
            DOWN: {
                key: 3,
            },
            LEFT: {
                key: 5,
            },
            RIGHT: {
                key: 4,
            },
            BACK: {
                key: 6,
            },
            ENTER: {
                key: 2,
            },
        };
        this.STATUS_COLOR_MAP = {
            OFF: {
                key: 0,
            },
            GREEN: {
                key: 1,
            },
            RED: {
                key: 2,
            },
            ORANGE: {
                key: 3,
            },
            GREEN_FLASH: {
                key: 4,
            },
            RED_FLASH: {
                key: 5,
            },
            ORANGE_FLASH: {
                key: 6,
            },
            GREEN_PULSE: {
                key: 7,
            },
            RED_PULSE: {
                key: 8,
            },
            ORANGE_PULSE: {
                key: 9,
            },
        };
        this.CURRENT_STATUS_COLOR = {
            COLOR: this.STATUS_COLOR_MAP.GREEN,
            APPLIED: true,
        };
        this.SENSOR_MAP = {
            '1': {
                type: this.deviceTypes.Touch,
                mode: 0,
            },
            '2': {
                type: this.deviceTypes.Touch,
                mode: 0,
            },
            '3': {
                type: this.deviceTypes.Touch,
                mode: 0,
            },
            '4': {
                type: this.deviceTypes.Touch,
                mode: 0,
            },
        };
        this.isSensing = false;
        this.LAST_PORT_MAP = null;
    }

    /**
     * Direct Send Command 의 앞 부분을 설정한다.
     *
     * @returns {Buffer} size(2byte) + counter(2byte) + mode(1byte) + header(2byte)
     * @param replyModeByte 0x00(reply required), 0x80(no reply)
     * @param allocHeaderByte 할당된 결과값 byte 수를 나타낸다. 이 값이 4인 경우, 4byte 를 result value 로 사용한다.
     */
    makeInitBuffer(replyModeByte, allocHeaderByte) {
        const size = new Buffer([0xff, 0xff]); // dummy 에 가깝다. #checkByteSize 에서 갱신된다.
        const counter = this.getCounter();
        const reply = new Buffer(replyModeByte);
        const header = new Buffer(allocHeaderByte);
        return Buffer.concat([size, counter, reply, header]);
    }

    /**
     * 카운터를 가져온다. 카운터 값은 request & response 가 동일하여, 정상값 체크를 위해 사용된다.
     * 이 값은 2^15 이상인 경우 0으로 초기화한다.
     * @returns {Buffer} little endian 2byte
     */
    getCounter() {
        let counterBuf = new Buffer(2);
        counterBuf.writeInt16LE(this.counter);
        if (this.counter >= 32767) {
            this.counter = 0;
        }
        this.counter++;
        return counterBuf;
    }

    MakeCommand(nCommand, bySize, contents)
	{
        let buf = new Buffer(15 + contents.length);
        buf[0] = 0xFF;
        buf[1] = 0xFF;
        buf[2] = 0xAA;
        buf[3] = 0x55;
        buf[4] = 0xAA;
        buf[5] = 0x55;
        buf[6] = 0x37;
        buf[7] = 0xBA;
        buf[8] = nCommand;
        buf[9] = 0;
        buf[10] = bySize[0];
        buf[11] = bySize[1];
        buf[12] = bySize[2];
        buf[13] = bySize[3];
        // 명령내용 복사
        let  checksum = 0;

        for(let i = 14; i < 14 + contents.length; i++)
        {
            buf[i] = contents[i - 14];
            checksum ^= buf[i];
        }
        buf[buf.length - 1] = checksum;

        return buf;
    }

    GetCommand(nCommand, bySize, contents)
    {
        let buf = this.MakeCommand(nCommand, bySize, contents);

        return buf;
    }
    
    GetDirectCommand(Mode, SID, data, ChecksumType)
    {
        let buffer = new Buffer(3 + data.length);

        buffer[0] = 0xFF;

        let b1 = Mode;
        b1 = b1 << 5;
        b1 += SID;
        buffer[1] = b1;
        for (let i = 0; i < data.length; i++)
        {
            buffer[i + 2] = data[i];
        }

        switch (ChecksumType)
        {
            case 1:
                this.GetCRC1(buffer);
                break;
            case 2:
                this.GetCRC2(buffer);
                break;
        }

        return buffer;
    }

    GetCRC1(buffer)
    {
        let checksum = 0;

        for (let i = 1; i < buffer.length - 1; i++)
        {
            checksum ^= buffer[i];
        }

        checksum &= 0x7F;

        buffer[buffer.length - 1] = checksum;
    }

    GetCRC2(buffer)
    {
        let checksum = 0;

        for (let i = 3; i < buffer.length - 1; i++)
        {
            checksum ^= buffer[i];
        }

        checksum &= 0x7F;

        buffer[buffer.length - 1] = checksum;
    }

    		/// <summary>
		/// PC 직접제어 모드 설정
		/// </summary>
    SetDirectControlMode()
    {
        let bySize = new Buffer(4);

        bySize[0] = 0;
        bySize[1] = 0;
        bySize[2] = 0;
        bySize[3] = 1;

        return this.GetCommand(16, bySize, new Buffer([1]));
    }

    /// <summary>
    /// RQC 제어모드 설정
    /// </summary>
    SetRQCControlMode()
    {
        let b = new Buffer(3);
        b[0] = 251;
        b[1] = 1;
        b[2] = 0;
        return this.GetDirectCommand(7, 0, b, 1);
    }

    // 직접제어명령
    // 서보모터 상태조회
    GetServoPosition(ID)
    {
        let b = new Buffer(1);
        b[0] = 0;
        return this.GetDirectCommand(5, ID, b, 1);
    }

    /// <summary>
    /// 서보모터 위치 설정
    /// </summary>
    /// <param name="ID"></param>
    /// <param name="Position"></param>
    /// <param name="speed"></param>
    SetServoPosion(ID, Position, speed)
    {
        let b = new Buffer(1);
        b[0] = Position;
        return this.GetDirectCommand(speed, ID, b, 1);
    }

    /// <summary>
    /// 서보모터 위치 설정
    /// </summary>
    /// <param name="ID"></param>
    /// <param name="Position"></param>
    /// <param name="speed"></param>
    SetServoSyncPosion(Position, Speed)
    {
        let b = new Buffer(Position.length + 1);
        b[0] = Position.length;

        for (let i = 0; i < Position.length; i++)
        {
            b[i + 1] = Position[i];
        }

        return this.GetDirectCommand(Speed, 31, b, 2);
    }

    /// <summary>
    /// 모터회전
    /// </summary>
    /// <param name="ID"></param>
    /// <param name="Direction"></param>
    /// <param name="Speed"></param>
    RotateMotor(ID, Direction, Speed)
    {
        if (Speed < 0)
        {
            Speed = 0;
        }
        if (Speed > 15)
        {
            Speed = 15;
        }

        let b1 = Direction;

        b1 <<= 4;
        b1 += Speed;

        let b = new Buffer(1);
        b[0] = b1;
        return this.GetDirectCommand(6, ID, b, 1);
    }

    /// <summary>
    /// 모터 PWM 제어
    /// </summary>
    /// <param name="ID"></param>
    /// <param name="Speed"></param>
    /// <returns></returns>
    PWMMotor(ID, Speed)
    {
        if (Speed > 254)
        {
            Speed = 254;
        }
        if (Speed < -254)
        {
            Speed = -254;
        }

        let direction = 0;

        if (Speed > 0)
        {
            direction = 0;
        }
        else
        {
            direction = 1;
        }

        let b1 = 5;
        b1 <<= 4;
        b1 += direction;

        let b = new Buffer(3);
        b[0] = b1;
        b[1] = Math.Abs(Speed);
        b[2] = direction;

        return this.GetDirectCommand(6, ID, b, 1);
    }



    /// <summary>
    /// 브레이크 모드
    /// </summary>
    BreakMode()
    {
        let b1 = 2;

        b1 <<= 4;

        let b = new Buffer(1);
        b[0] = b1;
        return this.GetDirectCommand(6, 31, b, 1);
    }

    /// <summary>
    /// 페시브 모드
    /// </summary>
    PassiveMode(ID)
    {
        let b1 = 1;

        b1 <<= 4;

        let b = new Buffer(1);
        b[0] = b1;
        return this.GetDirectCommand(6, ID, b, 1);
    }

    /// <summary>
    /// 서보모터 LED 상태 조회
    /// </summary>
    /// <param name="ID"></param>
    GetServoLed(ID)
    {
        let b = new Buffer(3);
        b[0] = 101;
        b[1] = 0;
        b[2] = 0;

        return this.GetDirectCommand(7, ID, b, 1);
    }

    /// <summary>
    /// 서보모터의 LED 상태 설정
    /// </summary>
    /// <param name="ID"></param>
    /// <param name="isOn"></param>
    SetServoLed(ID, isOn)
    {
        let b = new Buffer(3);
        b[0] = 100;
        if (isOn == false)
        {
            b[1] = 0;
        }
        else
        {
            b[1] = 1;
        }
        b[2] = b[1];

        return this.GetDirectCommand(7, ID, b, 1);
    }

    /// <summary>
    /// 터치 및 IR 값 조회
    /// </summary>
    /// <param name="ID"></param>
    /// <returns></returns>
    GetTouchIR(ID)
    {
        let b = new Buffer(3);
        b[0] = 243;
        b[1] = 0;
        b[2] = ID;

        return this.GetDirectCommand(7, ID, b, 1);
    }

    /// <summary>
    /// 마이크 값 조회
    /// </summary>
    /// <returns></returns>
    GetMic()
    {
        let b = new Buffer(3);
        b[0] = 234;
        b[1] = 0;
        b[2] = 0;

        return this.GetDirectCommand(7, 0, b, 1);
    }

    /// <summary>
    /// 리모콘 값 조회
    /// </summary>
    /// <returns></returns>
    GetRemote()
    {
        let b = new buffer(3);
        b[0] = 232;
        b[1] = 0;
        b[2] = 0;

        return this.GetDirectCommand(7, 0, b, 1);
    }

    DoMotion(MotionNo)
    {
        let b = new Buffer(3);
        b[0] = 225;
        b[1] = 0;
        b[2] = MotionNo;

        return this.GetDirectCommand(7, 0, b, 1);
    }

    /// 사운드 출력
    /// </summary>
    /// <param name="SoundNo"></param>
    PlaySound(SoundNo)
    {
        //FF E0 DD 00 01 3C
        //FF E0 DD 00 00 3D

        let b = new buffer(3);
        b[0] = 221;
        b[1] = 0;
        b[2] = SoundNo;
        return this.GetDirectCommand(7, 0, b, 1);
    }

    /// <summary>
    /// 에러코드 조회
    /// </summary>
    /// <param name="type"></param>
    GetErrorCode(type)
    {
        return this.GetCommand(17, new Buffer([0, 0, 0, 1 ]), new Buffer([type]));
    }

    // cb 은 화면의 이벤트를 보내는 로직입니다. 여기서는 connected 라는 신호를 보내 강제로 연결됨 화면으로 넘어갑니다.
	afterConnect(that, cb) {
        that.connected = true;
        if (cb) {
            cb('connected');
        }
    }


    /**
     * size 를 해당하는 2byte 를 제외한 값을 size 에 씌운다.
     *
     * TODO 그렇다면 makeInitBuffer의 size는 영원히 아무일도 하지 않는다.
     * @param buffer 파라미터가 완성된 buffer
     */
    checkByteSize(buffer) {
        const bufferlength = buffer.length - 2;
        buffer[0] = bufferlength;
        buffer[1] = bufferlength >> 8; // buffer length 가 2^8 을 넘는 값일경우, 남은 값을 다음 size byte 에 씌운다.
    }

    /**
     * 센서를 200ms 간격으로 체크한다. 센싱중에는 체크하지 않는다.
     */
    sensorChecking() {
        if (!this.isSensorCheck) {
            this.sensing = setInterval(() => {
                this.sensorCheck();
                this.isSensing = false;
            }, 200);
            this.isSensorCheck = true;
        }
    }

    init(handler, config) {

        this.handler = handler;
        this.config = config;
    }

    lostController() {}

    eventController(state) {
        if (state === 'connected') {
            clearInterval(this.sensing);
        }
    }

    setSerialPort(sp) {
        this.sp = sp;
    }

    /**
     * 모터를 정지하고, output 센서를 체크한다.
     * @param sp serial port
     * @returns {null} 직접 serial port 에 ByteArray 를 작성한다.
     */
    requestInitialData(sp) {
        this.isConnect = true;
        if (!this.sp) {
            this.sp = sp;
        }

        if (!this.isSendInitData) {
            
            const initCmd = new Buffer([0xff, 0xe0, 0xfb, 0x01, 0x0, 0x1a]);
            
            sp.write(initCmd, () => {
                this.sensorChecking();
            });
            
            const initBuf = new Buffer([0xff, 0xff, 0xaa, 0x55, 0xaa, 0x55, 0x37, 0xba, 0x12, 0x1, 0x0, 0x0, 0x0, 0x1, 0x1, 0x1]);

            sp.write(initBuf, () => {
                this.sensorChecking();
            });

            let setRQCMode = this.SetRQCControlMode();
            
            sp.write(setRQCMode, () => {
                this.sensorChecking();
            });

            let getError = this.GetErrorCode(1);

            sp.write(getError, () => {
                this.sensorChecking();
            });

            let setDirectMode = this.SetDirectControlMode();

            sp.write(setDirectMode, () => {
                this.sensorChecking();
            });
            
        }
        return true;
    }

    checkInitialData(data, config) {
        return true;
    }

    handleLocalData(data) {
        // data: Native Buffer
        if (data[0] === this.wholeResponseSize + 3 && data[1] === 0) {
            const countKey = data.readInt16LE(2);
            if (countKey in this.SENSOR_COUNTER_LIST) {
                this.isSensing = false;
                delete this.SENSOR_COUNTER_LIST[countKey];
                data = data.slice(5); // 앞의 4 byte 는 size, counter 에 해당한다. 이 값은 할당 후 삭제한다.
                let index = 0;

                Object.keys(this.SENSOR_MAP).forEach((p) => {
                    const port = Number(p) - 1;
                    index = port * this.commandResponseSize;

                    const type = data[index];
                    const mode = data[index + 1];
                    let siValue = Number(
                        (data.readFloatLE(index + 2) || 0).toFixed(1)
                    );
                    this.returnData[p] = {
                        type: type,
                        mode: mode,
                        siValue: siValue,
                    };
                });

                index = 4 * this.commandResponseSize;
                Object.keys(this.BUTTON_MAP).forEach((button) => {
                    if (data[index] === 1) {
                        console.log(button + ' button is pressed');
                    }

                    this.returnData[button] = {
                        pressed: data[index++] === 1,
                    };
                });
            }
        }
    }

    // Web Socket(엔트리)에 전달할 데이터
    requestRemoteData(handler) {
        Object.keys(this.returnData).forEach((key) => {
            if (this.returnData[key] !== undefined) {
                handler.write(key, this.returnData[key]);
            }
        });
    }

    // Web Socket 데이터 처리
    handleRemoteData(handler) {
        Object.keys(this.PORT_MAP).forEach((port) => {
            this.PORT_MAP[port] = handler.read(port);
        });
        Object.keys(this.SENSOR_MAP).forEach((port) => {
            this.SENSOR_MAP[port] = handler.read(port);
        });

        const receivedStatusColor = this.STATUS_COLOR_MAP[
            handler.read('STATUS_COLOR')
        ];
        if (
            receivedStatusColor !== undefined &&
            this.CURRENT_STATUS_COLOR.COLOR !== receivedStatusColor
        ) {
            this.CURRENT_STATUS_COLOR = {
                COLOR: receivedStatusColor,
                APPLIED: false,
            };
        }
    }

    // 하드웨어에 전달할 데이터
    requestLocalData() {
        let isSendData = false;
        const initBuf = this.makeInitBuffer([0x80], [0, 0]);
        let sendBody;
        this.sensorCheck();
        let skipPortOutput = false;

        //이전 포트결과에서 변한부분이 있는지 확인
        if (this.LAST_PORT_MAP) {
            const arr = Object.keys(this.PORT_MAP).filter((port) => {
                const map1 = this.PORT_MAP[port];
                const map2 = this.LAST_PORT_MAP[port];
                return !(map1.type === map2.type && map1.power === map2.power);
            });
            skipPortOutput = arr.length === 0;
        }

        //변한부분이 있다면 포트에 보낼 데이터를 생성
        if (!skipPortOutput) {
            isSendData = true;
            this.LAST_PORT_MAP = _.cloneDeep(this.PORT_MAP);
            sendBody = this.makePortCommandBuffer(isSendData);
        }

        //상판 LED 컬러 변경 요청이 있는 경우 변경 커맨드를 페이로드에 추가
        if (this.CURRENT_STATUS_COLOR.APPLIED === false) {
            isSendData = true;
            const statusLedCommand = this.makeStatusColorCommandBuffer(
                sendBody
            );

            if (!sendBody) {
                sendBody = statusLedCommand;
            } else {
                sendBody = Buffer.concat([sendBody, statusLedCommand]);
            }
        }

        if (isSendData && sendBody) {
            const totallength = initBuf.length + sendBody.length;
            const sendBuffer = Buffer.concat([initBuf, sendBody], totallength);
            this.checkByteSize(sendBuffer);
            return sendBuffer;
        }

        return null;
    }

    makeStatusColorCommandBuffer() {
        this.CURRENT_STATUS_COLOR.APPLIED = true;
        const statusLedCommand = new Buffer([
            0x82,
            0x1b,
            this.CURRENT_STATUS_COLOR.COLOR.key,
        ]);

        return new Buffer(statusLedCommand);
    }

    makePortCommandBuffer() {
        let sendBody = null;
        Object.keys(this.PORT_MAP).forEach((port) => {
            let backBuffer;
            let frontBuffer;
            const portMap = this.PORT_MAP[port];
            let brake = 0;
            let checkPortMap = this.CHECK_PORT_MAP[port];
            if (!checkPortMap || portMap.id !== checkPortMap.id) {
                let portOut;
                let power = Number(portMap.power);
                if (portMap.type === this.motorMovementTypes.Power) {
                    const time = Number(portMap.time) || 0;
                    brake = 0;
                    if (power > 100) {
                        power = 100;
                    } else if (power < -100) {
                        power = -100;
                    } else if (power === 0) {
                        brake = 1;
                    }

                    if (time <= 0) {
                        // infinity output port mode
                        portOut = new Buffer([
                            0xa4,
                            0x81,
                            0,
                            0x81,
                            this.outputPort[port],
                            0x81,
                            power,
                            0xa6,
                            0x81,
                            0,
                            0x81,
                            this.outputPort[port],
                        ]);
                    } else {
                        // time set mode 232, 3 === 1000ms
                        frontBuffer = new Buffer([
                            0xad,
                            0x81,
                            0,
                            0x81,
                            this.outputPort[port],
                            0x81,
                            power,
                            0x83,
                            0,
                            0,
                            0,
                            0,
                            0x83,
                        ]);
                        backBuffer = new Buffer([
                            0x83,
                            0,
                            0,
                            0,
                            0,
                            0x81,
                            brake,
                        ]);
                        const timeBuffer = new Buffer(4);
                        timeBuffer.writeInt32LE(time);
                        portOut = Buffer.concat([
                            frontBuffer,
                            timeBuffer,
                            backBuffer,
                        ]);
                    }
                } else {
                    const degree = Number(portMap.degree) || 0;
                    frontBuffer = new Buffer([
                        0xac,
                        0x81,
                        0,
                        0x81,
                        this.outputPort[port],
                        0x81,
                        power,
                        0x83,
                        0,
                        0,
                        0,
                        0,
                        0x83,
                    ]);
                    backBuffer = new Buffer([0x83, 0, 0, 0, 0, 0x81, brake]);
                    const degreeBuffer = new Buffer(4);
                    degreeBuffer.writeInt32LE(degree);
                    portOut = Buffer.concat([
                        frontBuffer,
                        degreeBuffer,
                        backBuffer,
                    ]);
                }

                if (portOut) {
                    if (!sendBody) {
                        sendBody = new Buffer(portOut);
                    } else {
                        sendBody = Buffer.concat([sendBody, portOut]);
                    }
                }

                this.CHECK_PORT_MAP[port] = this.PORT_MAP[port];
            }
        });
        return sendBody;
    }

    /**
     * requestInitialData(external interval) -> sensorChecking(interval) -> sensorCheck
     * 센서데이터를 연결해 한번에 보낸다.
     * output 이 존재하는 Port 1,2,3,4 번을 체크한다.
     *
     * 보내는 데이터는 여러개의 데이터 명령이고 받는 결과 또한 여러개의 결과값이다.
     */
    sensorCheck() {
       
    }

    connect() {}

    disconnect(connect) {
        if (this.isConnect) {
            clearInterval(this.sensing);

            this.isConnect = false;
            
            let setRQCMode = this.SetRQCControlMode();
            
            sp.write(setRQCMode, () => {
                this.sensorChecking();
            });
            
            connect.close();
            if (this.sp) {
                delete self.sp;
            }
        }
    }
    
    reset() {}
}

module.exports = new rq_robot();
