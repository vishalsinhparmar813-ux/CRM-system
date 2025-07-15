import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';

const BackdropLoading=({show})=> {
  return (
    <div>
      <Backdrop
        sx={{ color: '#fff', zIndex: 9999 }}
        open={!!show}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );
}

export default BackdropLoading;