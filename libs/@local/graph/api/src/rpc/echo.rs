use core::marker::PhantomData;

use error_stack::{Report, ResultExt as _};
use harpc_client::{connection::Connection, utils::invoke_call_discrete};
use harpc_codec::{decode::ReportDecoder, encode::Encoder};
use harpc_server::{
    error::DelegationError,
    session::Session,
    utils::{delegate_call_discrete, parse_procedure_id},
};
use harpc_system::delegate::SubsystemDelegate;
use harpc_tower::{body::Body, request::Request, response::Response};
use harpc_types::response_kind::ResponseKind;

use super::session::Account;

#[must_use]
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, derive_more::Display, derive_more::Error)]
#[display("unable to fullfil ping request")]
pub struct EchoError;

pub trait EchoSystem {
    type ExecutionScope;

    async fn echo(
        &self,
        scope: Self::ExecutionScope,
        payload: Box<str>,
    ) -> Result<Box<str>, Report<EchoError>>;
}

// TODO: this can be auto generated by the `harpc` crate
pub mod meta {
    //! The `meta` module contains the metadata for the ping service.
    //! In the future this will be automatically generated by the `harpc` crate.

    use frunk::HList;
    use harpc_system::{
        Subsystem,
        procedure::{Procedure, ProcedureIdentifier},
    };
    use harpc_types::{procedure::ProcedureId, version::Version};

    use crate::rpc::GraphSubsystemId;

    pub enum EchoProcedureId {
        Echo,
    }

    impl ProcedureIdentifier for EchoProcedureId {
        type Subsystem = EchoSystem;

        fn from_id(id: ProcedureId) -> Option<Self> {
            match id.value() {
                0x00 => Some(Self::Echo),
                _ => None,
            }
        }

        fn into_id(self) -> ProcedureId {
            match self {
                Self::Echo => ProcedureId::new(0x00),
            }
        }
    }

    pub struct EchoSystem;

    impl Subsystem for EchoSystem {
        type ProcedureId = EchoProcedureId;
        type Procedures = HList![ProcedureEcho];
        type SubsystemId = GraphSubsystemId;

        const ID: GraphSubsystemId = GraphSubsystemId::Echo;
        const VERSION: Version = Version {
            major: 0x00,
            minor: 0x00,
        };
    }

    pub struct ProcedureEcho;

    impl Procedure for ProcedureEcho {
        type Subsystem = EchoSystem;

        const ID: <Self::Subsystem as Subsystem>::ProcedureId = EchoProcedureId::Echo;
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct EchoServer;

impl EchoSystem for EchoServer {
    type ExecutionScope = Session<Account>;

    async fn echo(
        &self,
        _: Session<Account>,
        payload: Box<str>,
    ) -> Result<Box<str>, Report<EchoError>> {
        Ok(payload)
    }
}

// TODO: this can be auto generated by the `harpc` crate
#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct EchoDelegate<T> {
    inner: T,
}

impl<T> EchoDelegate<T> {
    #[must_use]
    pub const fn new(inner: T) -> Self {
        Self { inner }
    }
}

impl<T, C> SubsystemDelegate<C> for EchoDelegate<T>
where
    T: EchoSystem<echo(..): Send, ExecutionScope: Send> + Send,
    C: Encoder + ReportDecoder + Clone + Send,
{
    type Error = Report<DelegationError>;
    type ExecutionScope = T::ExecutionScope;
    type Subsystem = meta::EchoSystem;

    type Body<Source>
        = impl Body<Control: AsRef<ResponseKind>, Error = <C as Encoder>::Error>
    where
        Source: Body<Control = !, Error: Send + Sync> + Send + Sync;

    async fn call<B>(
        self,
        request: Request<B>,
        scope: T::ExecutionScope,
        codec: C,
    ) -> Result<Response<Self::Body<B>>, Self::Error>
    where
        B: Body<Control = !, Error: Send + Sync> + Send + Sync,
    {
        let id = parse_procedure_id(&request)?;

        match id {
            meta::EchoProcedureId::Echo => {
                delegate_call_discrete(request, codec, |payload| async move {
                    self.inner.echo(scope, payload).await
                })
                .await
            }
        }
    }
}

#[derive_where::derive_where(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct EchoClient<S, C> {
    _service: PhantomData<fn() -> *const S>,
    _codec: PhantomData<fn() -> *const C>,
}

impl<S, C> EchoClient<S, C> {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            _service: PhantomData,
            _codec: PhantomData,
        }
    }
}

impl<S, C> Default for EchoClient<S, C> {
    fn default() -> Self {
        Self::new()
    }
}

impl<S, C> EchoSystem for EchoClient<S, C>
where
    S: harpc_client::connection::ConnectionService<C>,
    C: harpc_client::connection::ConnectionCodec,
{
    type ExecutionScope = Connection<S, C>;

    async fn echo(
        &self,
        scope: Connection<S, C>,
        payload: Box<str>,
    ) -> Result<Box<str>, Report<EchoError>> {
        invoke_call_discrete(scope, meta::EchoProcedureId::Echo, [payload])
            .await
            .change_context(EchoError)
    }
}
