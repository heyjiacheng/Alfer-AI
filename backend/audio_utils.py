import os
import subprocess
import tempfile
from pathlib import Path
import logging
from typing import Optional, Tuple
import wave
import numpy as np
import sounddevice as sd
import soundfile as sf

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('audio_utils')

# 音频转录设置
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'base.en')  # 可选: tiny.en, base.en, small.en, medium.en, large-v2
WHISPER_EXECUTABLE = os.getenv('WHISPER_EXECUTABLE', 'whisper-cpp')

def convert_audio_to_wav(input_file: str) -> Optional[str]:
    """
    Use ffmpeg to convert any audio format to wav format for whisper processing
    
    Parameters:
        input_file: Path to the input audio file
        
    Returns:
        str: Path to the temporary wav file, None if failed
    """
    try:
        if not os.path.exists(input_file):
            logger.error(f"Input file does not exist: {input_file}")
            return None
            
        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            output_path = temp_file.name
        
        # Use ffmpeg to convert audio format
        cmd = ['ffmpeg', '-i', input_file, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output_path]
        
        logger.info(f"Converting audio file: {input_file} -> {output_path}")
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        if result.returncode != 0:
            logger.error(f"Audio conversion failed: {result.stderr.decode()}")
            return None
            
        return output_path
    except Exception as e:
        logger.error(f"Error occurred during audio conversion: {str(e)}")
        return None

def transcribe_audio(audio_file: str) -> Tuple[bool, str]:
    """
    Use whisper-cpp to transcribe an audio file
    
    Parameters:
        audio_file: Path to the audio file
        
    Returns:
        Tuple[bool, str]: (Success status, Transcribed text or error message)
    """
    try:
        # Ensure input file exists
        if not os.path.exists(audio_file):
            return False, f"Audio file does not exist: {audio_file}"
        
        # Get file extension
        file_ext = Path(audio_file).suffix.lower()
        
        # If not wav format, convert first
        wav_file = audio_file
        converted = False
        
        if file_ext != '.wav':
            wav_file = convert_audio_to_wav(audio_file)
            if not wav_file:
                return False, "Cannot convert audio to WAV format"
            converted = True
        
        logger.info(f"Starting to transcribe audio file: {audio_file}")
        
        # Create temporary file for saving transcription result
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
            output_path = temp_file.name
        
        # Use whisper-cpp for transcription
        cmd = [WHISPER_EXECUTABLE, '-m', f'/usr/local/share/whisper/{WHISPER_MODEL}.bin', '-f', wav_file, '-otxt', '-of', output_path]
        
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)  # Set 10 minutes timeout
        
        # If temporary WAV file was created, delete it
        if converted and os.path.exists(wav_file):
            os.remove(wav_file)
        
        if result.returncode != 0:
            error_msg = result.stderr.decode()
            logger.error(f"Transcription failed: {error_msg}")
            
            # If output file was created, delete it
            if os.path.exists(output_path):
                os.remove(output_path)
                
            return False, f"Audio transcription failed: {error_msg}"
        
        # Read transcription result
        with open(output_path, 'r', encoding='utf-8') as f:
            transcript = f.read().strip()
        
        # Delete temporary file
        os.remove(output_path)
        
        if not transcript:
            return False, "Transcription result is empty"
            
        logger.info(f"Audio transcription successful, text length: {len(transcript)} characters")
        return True, transcript
    except subprocess.TimeoutExpired:
        logger.error("Transcription timeout")
        return False, "Audio transcription timeout, file may be too long or processing resources insufficient"
    except Exception as e:
        logger.error(f"Error occurred during transcription: {str(e)}")
        return False, f"Audio transcription error: {str(e)}" 