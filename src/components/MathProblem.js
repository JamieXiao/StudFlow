import { useState } from 'react';
import { Button, Typography, FormControl, Select, InputLabel, MenuItem, ListItem, List, ListItemText, Divider, TextField, Box } from '@mui/material';
import { evaluate } from 'mathjs';

function createProblem() {
    const arithmeticOperators = ['+', '-', '*'];
    const nums = [Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 10) + 1];
    let operators = ['',''];
    let problem = '' + nums[0];

    for (let i = 1; i < nums.length; i++) {
        const operator = arithmeticOperators[Math.floor(Math.random() * arithmeticOperators.length)];
        operators[i-1] = operator;
        problem += ` ${operator} ${nums[i]}`;
    }
    const problemStr = problem.replaceAll('*', '×'); // pretty 
    const sum = evaluate(problem);

    return {
        question: problemStr,
        answer: sum
    }

}

function MathProblem() {
    // math
    const [mathProblem, setMathProblem] = useState(createProblem);
    const [answer, setAnswer] = useState('');
    const [answerWrong, setAnswerWrong] = useState(false);

    // submit
    function handleSubmit(event) {
        event.preventDefault();

        if (Number(answer) === mathProblem.answer) {
        chrome.runtime.sendMessage({
            type: 'stop alarm'
        });
        } else {
        setAnswerWrong(true);
        setAnswer('');
        }
    }

    return (
           <List sx={{
                py: 0,
                width: '100%',
                // maxWidth: 360,
                height: '100%',
                borderRadius: '4px',
                // borderColor: none,
                backgroundColor: 'background.paper',
                paddingBottom: '0.2rem',
           }}>
                <ListItem>
                    <Typography variant='h6' sx={{mt: 2, fontWeight: 500, fontFamily: 'monospace'}}>
                        You are not in the <span style={{color: '#449ae5'}}>flow</span>
                    </Typography>
                </ListItem>
                <Divider component='li' />
                <ListItem>
                    <p>Solve the following math problem to turn off the alarm.</p>
                </ListItem>
                <Divider component='li' variant='middle' />
                <ListItem sx={{textAlign: 'center'}}>
                    <Typography variant='h3' sx={{mb: 1}}>{mathProblem.question}</Typography>
                </ListItem>
                <ListItem>
                    <Box component='form' onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            autoFocus
                            type='number'
                            label='Answer'
                            value={answer}
                            onChange={(event) => {
                            setAnswer(event.target.value);
                            setAnswerWrong(false);
                            }}
                            error={answerWrong}
                            helperText={answerWrong ? 'Incorrect answer. Try Again.' : ''}
                            sx={{mb: 2}}
                            // inputProps={{ step: 1 }}
                        />
                        <Button variant="contained" onClick={handleSubmit} fullWidth sx={{backgroundColor: '#449ae5', color: 'white'}}
                        >
                            Submit
                        </Button>
                    </Box>                    
                </ListItem>
            </List>
        // <Box
        //     sx={{
        //         height: '100%',
        //         width: '100%',
        //         display: 'flex',
        //         alignItems: 'center',
        //         justifyContent: 'center',
        //         bgcolor: '#f4f6fa'
        //     }}
        // >
        //     <Typography variant='h6' sx={{ mb: 3 }}>Solve the following math problem to turn off the alarm.</Typography>
        //     <Typography variant='h3' sx={{ mb: 3 }}>{mathProblem.question}</Typography>

            // <Box component='form' onSubmit={handleSubmit}>
            // <TextField
            //     fullWidth
            //     autoFocus
            //     type='number'
            //     label='Answer'
            //     value={answer}
            //     onChange={(event) => {
            //     setAnswer(event.target.value);
            //     setAnswerWrong(false);
            //     }}
            //     error={answerWrong}
            //     helperText={answerWrong ? 'Incorrect answer. Try Again.' : ''}
            //     // inputProps={{ step: 1 }}
            // />

            // <Button
            //     fullWidth
            //     type='submit'
            //     variant='contained'
            //     size='large'
            //     sx={{ mt: 1 }}
            //     onClick={handleSubmit}
            // >
            //     Submit
            // </Button>
            // </Box>
        // </Box>
    )
}

export default MathProblem;