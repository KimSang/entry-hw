const _ = require('lodash');
const BaseModule = require('./baseModule');

class RQ extends BaseModule {
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
        this.CHECK_DC_MOTOR_MAP = {};
        this.CHECK_SAM3_MOTOR_MAP = {};
        this.CHECK_SOUND_MAP = {};
        this.CHECK_LED_MAP = {};
        this.CHECK_MOTION_MAP = {};
        this.SENSOR_COUNTER_LIST = {};
        this.returnData = {};
        this.get_pos = 0;
        this.isTouchGroupNo = 0;
        this.curr_pos = 0;

        this.deviceTypes = {
            RQ_Touch_1: 1,
            RQ_Touch_2: 2,
            RQ_Remote: 3,
            RQ_Sound: 4,
            RQ_Inf_1: 5,
            RQ_Inf_2: 6,
        };

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
            'rq_cmd_con_sam3_motor_position' : 10,
            'rq_cmd_sound_sensor' : 11,
            'rq_cmd_remote_control' : 12,
            'rq_cmd_infrared_ray_sensor' : 13,
            'rq_cmd_touch_sensor' : 14,
            'rq_cmd_play_sound' : 15,
            'rq_cmd_play_sound_second' : 16,
            'rq_cmd_stop_sound' : 17,
            'rq_cmd_on_led' : 18,
            'rq_cmd_off_led' : 19,
            'rq_cmd_motion' : 20,
        },

        this.DC_MOTOR_MAP = {
            A: {
                cmd: 0,
                motor : 0,
                direction : 0,
                speed : 0,
            },
            B: {
                cmd : 0,
                left_wheel : 0,
                right_wheel : 0,
            },
            C: {
                cmd : 0,
                stop : 0,
            },
        };
        
        this.SAM3_MOTOR_MAP = {
            D: {
                cmd : 0,
                motor : 0,
                direction : 0,
                speed : 0,
            },
            E: {
                cmd: 0,
                motor : 0,
                position : 0,
            },
            F: {
                cmd: 0,
                motor : 0,
            },
            G: {
                cmd: 0,
                motor : 0,
            },
            H1: {
                cmd: 0,
                motor : 0,
            },
        }

        this.SENSOR_MAP = {
            I: {
                type : this.deviceTypes.RQ_Sound,
                mode : 0,
                value : 0,
            },
            J: {
                type : this.deviceTypes.RQ_Remote,
                mode : 0,
                value : 0,
            },
            K1: {
                type : this.deviceTypes.RQ_Inf_1,
                mode : 0,
                value : 0,
            },
            K2: {
                type : this.deviceTypes.RQ_Inf_2,
                mode : 0,
                value : 0,
            },
            L1: {
                type : this.deviceTypes.RQ_Touch_1,
                mode : 0,
                value : 0,
            },
            L2: {
                type : this.deviceTypes.RQ_Touch_2,
                mode : 0,
                value : 0,
            },
        },

        this.SOUND_MAP = {
            M: {
                cmd: 0,
                play_list : null,
            },
            N: {
                cmd: 0,
                play_list : null,
                sec : 0,
            },
            O: {
                cmd : 0,
                stop : 0,
            },
        },

        this.LED_MAP = {
            P: {
                cmd: 0,
                led : 0,
                color : 0,
            },
            Q: {
                cmd : 0,
                led : 0,
            },
        },
        this.MOTION_MAP = {
            R: {
                cmd: 0,
                motion : 0,
            },
        },
        
        this.isSensing = false;
        this.LAST_DC_MOTOR_MAP = null;
        this.LAST_SENSOR_MAP = null;
        this.LAST_SOUND_MAP = null;
        this.LAST_LED_MAP = null;
        this.LAST_MOTION_MAP = null;
        this.LAST_SAM3_MOTOR_MAP = null;
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

    /**
     * PC 제어 모드 진입 명령 버퍼를 생성하는 함수이다. 
     * @param null
     * @returns PC 제어 모드 진입 명령 버퍼를 리턴한다.  
     */    
    SetDirectControlMode()
    {
        let bySize = new Buffer(4);

        bySize[0] = 0;
        bySize[1] = 0;
        bySize[2] = 0;
        bySize[3] = 1;

        return this.MakeCommand(16, bySize, new Buffer([1]));
    }

    /**
     * RQC 제어 모드 진입 명령 버퍼를 생성하는 함수이다. 
     * @param null
     * @returns RQC 제어 모드 진입 명령 버퍼를 리턴한다.  
     */
    SetRQCControlMode()
    {
        let b = new Buffer(3);
        b[0] = 251;
        b[1] = 1;
        b[2] = 0;
        return this.GetDirectCommand(7, 0, b, 1);
    }

    /**
     * 서보 모터의 각도 값을 얻어오는 함수이다. 
     * @param ID Servo Motor Number
     * @returns ID 값을 기준으로 서보모터의 각도를 얻기위한 명령 버퍼를 리턴한다.  
     */
    GetServoPosition(ID)
    {
        let b = new Buffer(1);
        b[0] = 0;
        return this.GetDirectCommand(5, ID, b, 1);
    }

    /**
     * 서보 모터의 각도를 조정하는 함수이다. 
     * @param ID Servo Motor Number
     * @param Position 서보 모터 각도 
     * @param Speed 모터 모드  
     * @returns ID, Position, Speed 값을 기준으로 서보모터 각도를 제어하는 명령 버퍼를 리턴한다.  
     */
    SetServoPosion(ID, Position, speed)
    {
        let b = new Buffer(1);
        b[0] = Position;
        return this.GetDirectCommand(speed, ID, b, 1);
    }


    /**
     * 모터를 작동 시키는 명령을 생성하는 함수이다.  
     * @param ID Servo Motor Number
     * @param Direction 모터 회전 방향
     * @param Speed 회전 속도 
     * @returns ID, Direction, Speed 값에 따라 모터를 작동 시키는 명령 버퍼를 리턴한다. 
     */
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

    /**
     * 모터를 정지 시키는 명령 버퍼를 생성하는 함수이다.  
     * @param null
     * @returns 모터 정리 명령 버퍼를 리턴한다. 
     */
    BreakMode()
    {
        let b1 = 2;

        b1 <<= 4;

        let b = new Buffer(1);
        b[0] = b1;
        return this.GetDirectCommand(6, 31, b, 1);
    }

    /**
     * 서보 모터를 Passive 모드로 변경하는 명령 버퍼를 생성한다.  
     * @param ID Servo Motor Number
     * @returns ID 값에 따라 PassiveMode 변경 명령 버퍼를 리턴한다. 
     */
    PassiveMode(ID)
    {
        let b1 = 1;

        b1 <<= 4;

        let b = new Buffer(1);
        b[0] = b1;
        return this.GetDirectCommand(6, ID, b, 1);
    }

    /**
     * 서보 모터의 LED 상태 조회 명령 버퍼를 생성하는 함수이다.  
     * @param ID Servo Motor Number
     * @returns ID 값에 따라 LED 상태 조회 명령 버퍼를 리턴한다. 
     */
    GetServoLed(ID)
    {
        let b = new Buffer(3);
        b[0] = 101;
        b[1] = 0;
        b[2] = 0;

        return this.GetDirectCommand(7, ID, b, 1);
    }

    /**
     * 서보모터에 내장된 LED의 상태를 조작하는 명령 버퍼를 생성하는 함수이다. 
     * @param ID Servo Motor Number
     * @param isOn LED 상태 
     * @returns ID, isOn 값에 따라 명령 버퍼를 리턴한다. 
     */
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

    /**
     * Touch 및 IR 센서 조회 명령 버퍼를 생성하는 함수이다. 
     * @param ID 조회하고자 하는 센서의 정보
     * @returns ID 값을 기반으로 조회 명령 버퍼를 리턴한다. 
     */
    GetTouchIR(ID)
    {
        let b = new Buffer(3);
        b[0] = 243;
        b[1] = 0;
        b[2] = ID;

        return this.GetDirectCommand(7, ID, b, 1);
    }

    /**
     * 마이크 값 조회 명령 버퍼를 생성하는 함수이다. 
     * @param null
     * @returns 입력된 마이크 값 조회 명령 버퍼를 리턴한다. 
     */
    GetMic()
    {
        let b = new Buffer(3);
        b[0] = 234;
        b[1] = 0;
        b[2] = 0;

        return this.GetDirectCommand(7, 0, b, 1);
    }

    /**
     * 입력된 리모콘 값 조회 명령 버퍼를 생성하는 함수이다. 
     * @param null
     * @returns 입력된 리모콘 값 조회 명령 버퍼를 리턴한다. 
     */
    GetRemote()
    {
        let b = new Buffer(3);
        b[0] = 232;
        b[1] = 0;
        b[2] = 0;

        return this.GetDirectCommand(7, 0, b, 1);
    }

    /**
     * LED 제어 명령 버퍼를 생성하는 함수이다.  
     * @param ID LED Number
     * @param type LED Color
     * @returns ID, type를 기반으로 LED 제어 명령 버퍼를 리턴한다.  
     */
    SetLed(ID, type)
    {
        let b = new Buffer(3);
        
        b[0] = 100;
        b[1] = type;
        b[2] = b[1];

        return this.GetDirectCommand(7, ID, b, 1);
    }

    /**
     * 모션 명령 버퍼 생성 작업을 수행하는 함수이다. 
     * @param MotionNo Motion Number 
     * @returns MotionNo 를 기반으로 모션 명령 버퍼를 리턴한다.  
     */
    DoMotion(MotionNo)
    {
        let b = new Buffer(3);
        b[0] = 225;
        b[1] = 0;
        b[2] = MotionNo;

        return this.GetDirectCommand(7, 0, b, 1);
    }

    /**
     * 사운드 재생 명령 버퍼 생성 작업을 수행하는 함수이다. 
     * @param SoundNo Sound Number
     * @returns SoundNo 를 기반으로 사운드 재생 명령 버퍼를 리턴한다.  
     */
    PlaySound(SoundNo)
    {
        //FF E0 DD 00 01 3C
        //FF E0 DD 00 00 3D

        let b = new Buffer(3);
        b[0] = 221;
        b[1] = 0;
        b[2] = SoundNo;
        return this.GetDirectCommand(7, 0, b, 1);
    }

    /**
     * 에러 코드 명령 버퍼 생성 작업을 수행하는 함수이다. 
     * @param type ErrorCode Type 
     * @returns Buffer type를 기반으로 에러코드 조회 명령 버퍼를 리턴한다. 
     */

    GetErrorCode(type)
    {
        return this.MakeCommand(17, new Buffer([0, 0, 0, 1 ]), new Buffer([type]));
    }

    // cb 은 화면의 이벤트를 보내는 로직입니다. 여기서는 connected 라는 신호를 보내 강제로 연결됨 화면으로 넘어갑니다.
	afterConnect(that, cb) {
        that.connected = true;
        if (cb) {
            cb('connected');
        }
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
        /*        
        if (state === 'connected') {
            clearInterval(this.sensing);
        }*/
    }

    setSerialPort(sp) {
        this.sp = sp;
    }

    /**
     * 전원 투입 후 기본 상태는 RBC 제어 모드로 되어 있다. 
     * MSRS 서비스 실행시 PC 제어 모드로 변경 후 서비스 종료시에는 RBC 제어 모드로 돌아오는 것을 원칙으로 한다. 
     * @param sp serial port
     * @returns {null} 직접 serial port 에 ByteArray 를 작성한다.
     */
    requestInitialData(sp) {
        this.isConnect = true;
        if (!this.sp) {
            this.sp = sp;
        }

        if (!this.isSendInitData) {

            let setRQCMode = this.SetRQCControlMode();
            
            sp.write(setRQCMode);

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

        if(data.length == 0x02 && data[0] == 0x0 && this.curr_pos != data[1])
        {
            this.curr_pos = data[1];
            this.returnData['HR'] = {
                motor : Number(data[0]),
                value : Number(data[1]),
            }
            this.get_pos = Number(data[1]);
        }
        else if(data.length == 0x02 && data[0] == 0xf3)
        {
            if(this.isTouchGroupNo == 0x0)
            {
                this.returnData['L1'] = {
                    type : this.deviceTypes.RQ_Touch_1,
                    mode : 1,
                    value : ((data[1]==0xff)?1:0),
                }
            }
            else if(this.isTouchGroupNo == 0x1)
            {
                this.returnData['L2'] = {
                    type : this.deviceTypes.RQ_Touch_2,
                    mode : 1,
                    value : ((data[1]==0xff)?1:0),
                }
            }
            else if(this.isTouchGroupNo == 0x2)
            {
                this.returnData['K1'] = {
                    type : this.deviceTypes.RQ_Inf_1,
                    mode : 1,
                    value : Number(data[1])
                }
            }
            else if(this.isTouchGroupNo == 0x3)
            {
                this.returnData['K2'] = {
                    type : this.deviceTypes.RQ_Inf_2,
                    mode : 1,
                    value : Number(data[1])
                }
            }
            this.isTouchGroupNo++;
        }
        else if(data.length == 0x02 && data[1] == 0x0 && this.isTouchGroupNo == 0x4)
        {
            this.returnData['I'] = {
                type : this.deviceTypes.RQ_Sound,
                mode : 1,
                value : Number(data[0]),
            }
            this.isTouchGroupNo++;
        }

        if( this.isTouchGroupNo % 5 == 0)
        {
            this.isTouchGroupNo = 0;
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

    handleRemoteData(handler) {
        Object.keys(this.DC_MOTOR_MAP).forEach((port) => {
            this.DC_MOTOR_MAP[port] = handler.read(port);
        });
        Object.keys(this.SAM3_MOTOR_MAP).forEach((port) => {
            this.SAM3_MOTOR_MAP[port] = handler.read(port);
        });
        Object.keys(this.SENSOR_MAP).forEach((port) => {
            this.SENSOR_MAP[port] = handler.read(port);
        });
        Object.keys(this.SOUND_MAP).forEach((port) => {
            this.SOUND_MAP[port] = handler.read(port);
        });
        Object.keys(this.LED_MAP).forEach((port) => {
            this.LED_MAP[port] = handler.read(port);
        });
        Object.keys(this.MOTION_MAP).forEach((port) => {
            this.MOTION_MAP[port] = handler.read(port);
        });
    }

    // 하드웨어에 전달할 데이터
    requestLocalData() {

        let skipOutput_dc_motor = false;
        let skipOutput_sam3_motor = false;
        let skipOutput_sound = false;
        let skipOutput_led = false;
        let skipOutput_motion = false;

        if(this.LAST_DC_MOTOR_MAP) {
            const arr = Object.keys(this.DC_MOTOR_MAP).filter((port) => {
                const map1 = this.DC_MOTOR_MAP[port];
                const map2 = this.LAST_DC_MOTOR_MAP[port];
                let ret = 0;

                switch(port)
                {
                    case 'A':
                        if(!(map1.cmd === map2.cmd && 
                            map1.motor === map2.motor && 
                            map1.direction === map2.direction && 
                            map1.speed === map2.speed))
                        {
                            ret = true;

                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_move_dc_motor)
                            {
                                let buf = this.RotateMotor(Number(map1.motor), Number(map1.direction), Number(map1.speed));
                                this.sp.write(buf);
                            }
                        }
                        break;
                    case 'B':
                        if(!(map1.cmd === map2.cmd && 
                            map1.left_wheel === map2.left_wheel && 
                            map1.right_wheel === map2.right_wheel))
                            {
                                if(map1.cmd == this.COMMAND_MAP.rq_cmd_set_dc_motor_position)
                                {
                                    let left_wheel = Number(map1.left_wheel);
                                    let right_wheel = Number(map1.right_wheel);
                                    let left_direction = left_wheel > 0 ? 3:4;
                                    let right_direction = right_wheel > 0 ? 4:3;

                                    let left_buf = this.RotateMotor(29, left_direction, Math.abs(left_wheel));
                                    this.sp.write(left_buf);
                                    let right_buf = this.RotateMotor(30, right_direction, Math.abs(right_wheel));
                                    this.sp.write(right_buf);
                                }
                                
                                ret = true;
                            }
                        break;
                    case 'C':
                        if(!(map1.cmd === map2.cmd && map1.stop === map2.stop))
                        {
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_stop_dc_motor && map1.stop == 1)
                            {
                                let buf = this.BreakMode();
                                this.sp.write(buf);
                                map1.stop = 0;
                            }
                            ret = true;
                        }
                        break;
                    default:
                        ret = false;
                }

                return ret;
            });

            skipOutput_dc_motor = arr.length === 0;
        }

        if(!skipOutput_dc_motor){
            this.LAST_DC_MOTOR_MAP = _.cloneDeep(this.DC_MOTOR_MAP);
        }

        if(this.LAST_SAM3_MOTOR_MAP) {
            const arr = Object.keys(this.SAM3_MOTOR_MAP).filter((port) => {
                const map1 = this.SAM3_MOTOR_MAP[port];
                const map2 = this.LAST_SAM3_MOTOR_MAP[port];
                let ret = 0;

                switch(port)
                {
                    case 'D':
                        if(!(map1.cmd === map2.cmd && 
                            map1.motor === map2.motor && 
                            map1.direction === map2.direction && 
                            map1.speed === map2.speed))
                        {
                            ret = true;

                            if( map1.cmd == this.COMMAND_MAP.rq_cmd_move_sam3_motor)
                            {
                                let buf = this.RotateMotor(Number(map1.motor), Number(map1.direction), Number(map1.speed));
                                this.sp.write(buf);
                            }

                        }
                        break;
                    case 'E':
                        if(!(map1.cmd === map2.cmd && 
                            map1.motor === map2.motor && 
                            map1.position === map2.position))
                        {
                            ret = true;

                            if( map1.cmd == this.COMMAND_MAP.rq_cmd_set_sam3_motor_position)
                            {
                                let buf = this.SetServoPosion(Number(map1.motor), Number(map1.position), 2);
                                this.sp.write(buf);
                            }
                        }
                        break;
                    case 'F':
                        if(!(map1.cmd === map2.cmd && 
                            map1.motor === map2.motor))
                        {
                            ret = true;  
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_on_sam3_led)
                            {
                                let buf = this.SetServoLed(Number(map1.motor), true);
                                this.sp.write(buf);
                            } 
                            else if(map1.cmd == this.COMMAND_MAP.rq_cmd_off_sam3_led)
                            {
                                let buf = this.SetServoLed(Number(map1.motor), false);
                                this.sp.write(buf);
                            }
                        }
                        break;
                    case 'G':
                        if(!(map1.cmd === map2.cmd && 
                            map1.motor === map2.motor))
                        {
                            ret = true;   
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_move_sam3_motor_manual)
                            {
                                let buf = this.PassiveMode(Number(map1.motor));
                                this.sp.write(buf);
                            }
                        }
                        break;
                    case 'H1':
                            if(!(map1.cmd === map2.cmd && 
                                map1.motor === map2.motor))
                            {
                                ret = true;   
                                if(map1.cmd == this.COMMAND_MAP.rq_cmd_con_sam3_motor_position)
                                {
                                    let buf = this.SetServoPosion(Number(map1.motor), this.get_pos, 2);
                                    this.sp.write(buf);
                                }
                            }
                            break;
                    default:
                        ret = false;
                }

                return ret;
            });

            skipOutput_sam3_motor = arr.length === 0;
        }

        if(!skipOutput_sam3_motor){
            this.LAST_SAM3_MOTOR_MAP = _.cloneDeep(this.SAM3_MOTOR_MAP);
        }

        if(this.LAST_SOUND_MAP) {
            const arr = Object.keys(this.SOUND_MAP).filter((port) => {
                const map1 = this.SOUND_MAP[port];
                const map2 = this.LAST_SOUND_MAP[port];
                let ret = 0;

                switch(port)
                {
                    case 'M':
                        if(!(map1.cmd === map2.cmd && map1.play_list === map2.play_list))
                        {
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_play_sound)
                            {
                                let buf = this.PlaySound(Number(map1.play_list));
                                this.sp.write(buf);
                            }
                            ret = true;
                        }
                        break;
                    case 'N':
                        if(!(map1.cmd === map2.cmd && 
                            map1.play_list === map2.play_list && 
                            map1.sec === map2.sec))
                        {
                            if( map1.cmd == this.COMMAND_MAP.rq_cmd_play_sound_second)
                            {
                                let buf = this.PlaySound(Number(map1.play_list));
                                this.sp.write(buf);
                            } 
                            ret = true;
                        }
                        break;
                    case 'O':
                        if(!(map1.cmd === map2.cmd && map1.stop === map2.stop))
                        {
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_stop_sound && map1.stop == 1)
                            {
                                let buf = this.PlaySound(0);
                                this.sp.write(buf);
                                map1.stop = 0;
                            }
                            ret = true;
                        }
                        break;
                    default:
                        ret = false;
                }

                return ret;
            });

            skipOutput_sound = arr.length === 0;
        }

        if(!skipOutput_sound){
            this.LAST_SOUND_MAP = _.cloneDeep(this.SOUND_MAP);
        }

        if(this.LAST_LED_MAP) {
            const arr = Object.keys(this.LED_MAP).filter((port) => {
                const map1 = this.LED_MAP[port];
                const map2 = this.LAST_LED_MAP[port];
                let ret = 0;

                switch(port)
                {
                    case 'P':
                        if(!(map1.cmd === map2.cmd && 
                                map1.led === map2.led && 
                                map1.color === map2.color))
                        {
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_on_led)
                            {
                                let buf = this.SetLed(Number(map1.led), Number(map1.color));
                                this.sp.write(buf);
                            }
                            ret = true;
                        }
                        break;
                    case 'Q':
                        if(!(map1.cmd === map2.cmd && map1.led === map2.led))
                        {
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_off_led)
                            {
                                let buf = this.SetLed(Number(map1.led), 0);
                                this.sp.write(buf);
                            }
                            ret = true;
                        }
                        break;
                    default:
                        ret = false;
                }
                return ret;
            });

            skipOutput_led = arr.length === 0;
        }

        if(!skipOutput_led){
            this.LAST_LED_MAP = _.cloneDeep(this.LED_MAP);
        }

        if(this.LAST_MOTION_MAP) {
            const arr = Object.keys(this.MOTION_MAP).filter((port) => {
                const map1 = this.MOTION_MAP[port];
                const map2 = this.LAST_MOTION_MAP[port];
                let ret = 0;

                switch(port)
                {
                    case 'R':
                        if(!(map1.cmd === map2.cmd && map1.motion === map2.motion))
                        {
                            if(map1.cmd == this.COMMAND_MAP.rq_cmd_motion)
                            {
                                let buf = this.DoMotion(Number(map1.motion));
                                this.sp.write(buf);
                            }
                        }
                        break;
                    default:
                        ret = false;
                }

                return ret;
            });

            skipOutput_motion = arr.length === 0;
        }

        if(!skipOutput_motion){
            this.LAST_MOTION_MAP = _.cloneDeep(this.MOTION_MAP);
        }

        return null;
    }

    /**
     * requestInitialData(external interval) -> sensorChecking(interval) -> sensorCheck
     * 센서데이터를 연결해 한번에 보낸다.
     *
     * 보내는 데이터는 여러개의 데이터 명령이고 받는 결과 또한 여러개의 결과값이다.
     */
    sensorCheck() {
        
        if (!this.isSensing) {
            this.isSensing = true;

            for(let i = 0; i< 1; i++)
            {
                let buf = this.GetServoPosition(i);
                this.sp.write(buf);
            }

            Object.keys(this.SENSOR_MAP).filter((p) => {

                switch(p)
                {
                    case 'L1':
                        if(this.isTouchGroupNo == 0x0)
                        {
                            var buf = this.GetTouchIR(0);
                            this.sp.write(buf);
                        }
                        break;
                    case 'L2':
                        if(this.isTouchGroupNo == 0x1)
                        {
                            var buf = this.GetTouchIR(2);
                            this.sp.write(buf);
                        }
                        break;
                    case 'K1':
                        if(this.isTouchGroupNo == 0x2)
                        {
                            var buf = this.GetTouchIR(1);
                            this.sp.write(buf);
                        }
                        break;
                    case 'K2':
                        if(this.isTouchGroupNo == 0x3)
                        {
                            var buf = this.GetTouchIR(3);
                            this.sp.write(buf);
                        }
                        break;
                    case 'I':
                        if(this.isTouchGroupNo == 0x4)
                        {
                            var buf = this.GetMic();
                            this.sp.write(buf);
                        }
                        break;  
                    case 'J':
                        if(this.isTouchGroupNo == 0x5)
                        {
                            var buf = this.GetRemote();
                            this.sp.write(buf);
                        }
                        break;
                }
            });

        }   
        
    }

    connect() {}

    disconnect(connect) {
        if (this.isConnect) {
            clearInterval(this.sensing);

            this.isConnect = false;
            this.isSendInitData = false;
            this.isSensorCheck = false;
            
            let setRQCMode = this.SetRQCControlMode();
            
            if(this.sp)
            {
                this.sp.write(setRQCMode, 
                    (err) => {
                    this.sp = null;
                    if(err)
                    {
                        console.log(err);
                    }            
                });
                
                connect.close();
                if (this.sp) {
                    delete this.sp;
                }
            }
            else{
                connect.close();
            }
        }
    }
    
    reset() {
        this.sp = null;
    }
}

module.exports = new RQ();
