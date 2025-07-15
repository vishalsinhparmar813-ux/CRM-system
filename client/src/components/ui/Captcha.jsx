import ReCAPTCHA from "react-google-recaptcha";
import { sitekeyCaptcha } from '@/constant/common';

const Captcha = ({ captchaOnChange }) => {
    return (
        <ReCAPTCHA
            sitekey={sitekeyCaptcha}
            onChange={captchaOnChange}
        />
    )
}

export default Captcha