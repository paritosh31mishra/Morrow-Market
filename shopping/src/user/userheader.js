import {Link}  from 'react-router-dom';
const UserHeader = () =>{
    return(
        <nav className="navbar navbar-expand-lg bg-dark sticky-top p-3">
        <div className="container-fluid">
          <a className="navbar-brand text-white" href="#"><i className='fa fa-shopping-bag fa-lg text-warning'></i>  Morrow Market</a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
                {/* by using ms-auto ul will be shifted to right and by writing mx-auto ul will be shifted to middle */}
              <li className="nav-item me-5">
                <Link className="nav-link text-white" to="/" > <i className='fa fa-home'></i>  Home</Link>
              </li>

              <li className="nav-item me-5">
                <Link className="nav-link text-white" to="/cart"> <i className='fa fa-shopping-cart'></i>  My Cart</Link>
              </li>
             
              <li className="nav-item me-5">
                <Link className="nav-link text-white" to="/login"> <i className='fa fa-lock'></i>  Seller Login</Link>
              </li>

              <li className="nav-item me-5">
                <Link className="nav-link  text-white" to="/register"><i className='fa fa-user-plus'></i>  Seller Create Account</Link>
              </li>
            </ul>
            
          </div>
        </div>
      </nav>

     

    
    )
}

export default UserHeader;
