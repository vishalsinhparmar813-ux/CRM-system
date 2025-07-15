import { toast } from "react-toastify";

const useToast = () => {

    const toastSuccess = (message) => {
        return toast.success(message, {
            color: "#2F3940",
            position: "bottom-center",
            autoClose: 1500,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: false,
            progress: undefined,
            theme: "dark",
        });
    }
    const toastError = (message) => {
        return toast.error(message, {
            color: "#2F3940",
            position: "bottom-center",
            autoClose: 1500,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: false,
            progress: undefined,
            theme: "dark"
        });
    }
    const toastInfo = (message) => {
        return toast.info(message, {
            position: "bottom-center",
            autoClose: 1500,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: false,
            progress: undefined,
            theme: "dark",
        });
    }

    return { toastSuccess, toastError, toastInfo };
}

export default useToast;