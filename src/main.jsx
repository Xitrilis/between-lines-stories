import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
class ErrorBoundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error}}render(){return this.state.error?<main className="fatal"><h1>Не удалось открыть приложение</h1><p>Ваши сохранённые истории остались на компьютере.</p><pre>{this.state.error.message}</pre><button onClick={()=>location.reload()}>Попробовать снова</button></main>:this.props.children}}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
