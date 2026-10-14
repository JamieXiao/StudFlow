import { useState, useEffect } from 'react';
import { Button, Typography, FormControl, Select, InputLabel, MenuItem, ListItem, List, ListItemText, Divider } from '@mui/material';
import dayjs from 'dayjs';
import { TimeField, LocalizationProvider } from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';

function Settings() {
    const [faceWindowID, setFaceWindowID] = useState(null);
    const [sleepThreshold, setSleepThreshold] = useState(5000);
    const [timer, setTimer] = useState(dayjs("9999-12-31T00:00:05"));

    const [alarmType, setAlarmType] = useState('/alarm_sfx/alarm_clock.mp3');
    const alarmTypes = {
        'Alarm Clock': '/alarm_sfx/alarm_clock.mp3',
        'iPhone alarm' : '/alarm_sfx/iphone_alarm.mp3'
    };

    useEffect(() => {
        const getDataThreshold = async () => {
            const res = await chrome.storage.local.get(["sleep_threshold", "alarm_sound"]); 
            if (res.sleep_threshold !== undefined) {
                setSleepThreshold(res.sleep_threshold);
                let inSecs = sleepThreshold/1000;
                const hr = String(Math.floor(inSecs/3600)).padStart(2, '0'); // make 2 digit long
                inSecs %= 3600;
                const m = String(Math.floor(inSecs/60)).padStart(2, '0'); 
                inSecs %= 60;
                const s = String(inSecs).padStart(2, '0'); 

                setTimer(dayjs(`9999-12-31T${hr}:${m}:${s}`));
            } else await chrome.storage.local.set({sleep_threshold: sleepThreshold}); 
            if (res.alarm_sound !== undefined) {
                setAlarmType(res.alarm_sound);
            } else await chrome.storage.local.set({alarm_sound: alarmType}); 
        }
        getDataThreshold();
    })

    const setDataThreshold = async (newThreshold) => {
        if (!newThreshold) return;

        const inMilli = (newThreshold.hour()*3600 + newThreshold.minute()*60 + newThreshold.second()) * 1000;
        await chrome.storage.local.set({sleep_threshold: inMilli}); 
        setSleepThreshold(inMilli);
        setTimer(newThreshold);
    }

    const setDataAlarm = async (newSound) => {
        if (!newSound) return;

        await chrome.storage.local.set({alarm_sound: newSound});
        setAlarmType(newSound);
        // setTimer(newThreshold);
    }

    // start webcam and face landmarker logic
    const start = () => {
        if (faceWindowID !== null) {
            chrome.windows.update(faceWindowID, {
                focused: true
            })
            return;
        }
        
        chrome.windows.create({
            url: chrome.runtime.getURL("index.html?mode=study"),
            type: "popup",
            width: 320,
            height: 265
            },
            (window) => {
                if (window) setFaceWindowID(window.id);
        });
    
    }

    chrome.windows.onRemoved.addListener((windowID) => {
        if(windowID === faceWindowID) setFaceWindowID(null);
    })

    return (
       <List sx={{
            py: 0,
            width: '100%',
            maxWidth: 360,
            borderRadius: '4px',
            // borderColor: none,
            backgroundColor: 'background.paper',
            boxShadow: '0px 10px 20px rgba(0,0,0,0.3)',
            paddingBottom: '0.2rem'
       }}>
            <ListItem>
                <Typography variant='h5' sx={{m: 0, fontWeight: 500, fontFamily: 'monospace'}}>
                    Stud<span style={{color: '#449ae5'}}>Flow</span>
                </Typography>
            </ListItem>
            <Divider component='li' />
            <ListItem>
                <LocalizationProvider dateAdapter={AdapterDayjs} sx={{width: '100%'}}>
                    <TimeField label='HH:MM:SS' value={timer} format='HH:mm:ss' onChange={(val) => setDataThreshold(val)} sx={{borderColor: 'divider'}} />
                </LocalizationProvider>
            </ListItem>
            <Divider component='li' variant='middle' />
            <ListItem>
                <FormControl fullWidth>
                <InputLabel id="demo-simple-select-label">Alarm Sound</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={alarmType}
                    label="Alarm Sound"
                    onChange={(event) => setDataAlarm(event.target.value)}
                    sx={{borderColor: 'divider'}} 
                >
                    {Object.entries(alarmTypes).map(([label, source]) => (
                        <MenuItem key={source} value={source}>{label}</MenuItem>
                    ))
                    }
                </Select>
            </FormControl>
            </ListItem>
            <Divider component='li' />
            <ListItem>
                <Button variant="contained" onClick={start} fullWidth sx={{backgroundColor: '#449ae5', color: 'white'}}>
                    Start Study Session
                </Button>
            </ListItem>
        </List>
    );
}

export default Settings;