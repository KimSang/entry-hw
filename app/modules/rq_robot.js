const _ = require('lodash');
const BaseModule = require('./baseModule');

class rq_robot extends BaseModule {
    constructor() {
        super();

        this.isSendInitData = false;
        this.isSensorCheck = false;
        this.isConnect = false;

        this.sp = null;
        this.handler = null;
        this.config = null;
        this.com_port = null;

        this.sensors = [];
        this.CHECK_PORT_MAP = {};
        this.SENSOR_COUNTER_LIST = {};
        this.returnData = {};

        this.COMMAND_MAP = {
            'rq_cmd_move_dc_motor' : 1,
            'rq_cmd_set_dc_motor_position' : 2,
            'rq_cmd_stop_dc_motor' : 3,
            'rq_cmd_move_sam3_motor' : 4,
            'rq_cmd_set_sam3_motor_position' : 5,
            'rq_cmd_on_sam3_led' : 6,
            'rq_cmd_off_sam3_led' : 7,
            'rq_cmd_move_sam3_motor_manual' : 8,
            'rq_cmd_get_sam3_motor_position' : 9,
            'rq_cmd_sound_sensor' : 10,
            'rq_cmd_infrared_ray_sensor' : 11,
            'rq_cmd_touch_sensor' : 12,
            'rq_cmd_play_sound' : 13,
            'rq_cmd_play_sound_second' : 14,
            'rq_cmd_stop_sound' : 15,
            'rq_cmd_on_led' : 16,
            'rq_cmd_off_led' : 17,
            'rq_cmd_motion' : 18,
        },

        this.PORT_MAP = {
            A: {
                cmd: this.COMMAND_MAP.rq_cmd_move_dc_motor,
                motor : 0,
                direction : 0,
                speed : 0,
            },
            B: {
                cmd : this.COMMAND_MAP.rq_cmd_set_dc_motor_position,
                left_wheel : 0,
                right_wheel : 0,
            },
            C: {
                cmd : this.COMMAND_MAP.rq_cmd_stop_dc_motor,
            },
            D: {
                cmd : this.COMMAND_MAP.rq_cmd_move_sam3_motor,
                motor : 0,
                direction : 0,
                speed : 0,
            },
            E: {
                cmd: this.COMMAND_MAP.rq_cmd_set_sam3_motor_position,
                motor : 0,
                position : 0,
            },
            F: {
                type: this.COMMAND_MAP.rq_cmd_on_sam3_led,
                motor : 0,
            },
            G: {
                type: this.COMMAND_MAP.rq_cmd_move_sam3_motor_manual,
                motor : 0,
            },
            H: {
                type: this.COMMAND_MAP.rq_cmd_get_sam3_motor_position,
                motor : 0,
            },
        };

        this.isSensing = false;
        this.LAST_PORT_MAP = null;
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
        return null;
    }

    checkInitialData(data, config) {
        return true;
    }

    handleLocalData(data) {
       
    }

    // Web Socket(엔트리)에 전달할 데이터
    requestRemoteData(handler) {
/*
        Object.keys(this.returnData).forEach((key) => {
            if (this.returnData[key] !== undefined) {
                handler.write(key, this.returnData[key]);
            }
        });
  */
    }

    handleRemoteData(handler) {
        Object.keys(this.PORT_MAP).forEach((port) => {
            this.PORT_MAP[port] = handler.read(port);
            console.log(handler.read(port));
        });
    }

    // 하드웨어에 전달할 데이터
    requestLocalData() {
        return null;
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
            
            this.sp.write(setRQCMode, () => {
                this.sensorChecking();
            });
            
            connect.close();
            if (this.sp) {
                delete self.sp;
            }
        }
    }
    
    reset() {
        this.sp = null;
    }
}

module.exports = new rq_robot();
